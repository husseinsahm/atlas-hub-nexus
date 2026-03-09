import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass, MapPin, Calendar, Users, Clock, Globe,
  Hotel, Landmark, Bike, Car, UtensilsCrossed, UserCheck,
  FileText, ChevronDown, Loader2, AlertCircle,
  Sun, Moon, Sunrise, Sunset,
  MessageCircle, CheckCircle, RefreshCw, Send, User,
  Lock, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

/* ====== TYPES ====== */
interface BookingDay {
  id: string;
  day_number: number;
  title: string | null;
  description: string | null;
  short_description: string | null;
  city: string | null;
  date: string | null;
  pickup_location: string | null;
  pickup_time: string | null;
  dropoff_location: string | null;
  booking_day_items: BookingDayItem[];
}

interface BookingDayItem {
  id: string;
  booking_day_id: string;
  custom_title: string | null;
  custom_description: string | null;
  category: string;
  sort_order: number;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  currency: string;
  duration_minutes: number | null;
  start_time: string | null;
  notes: string | null;
}

interface BookingFeedback {
  id: string;
  booking_id: string;
  feedback_type: string;
  client_name: string;
  client_email: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

/* ====== CONSTANTS ====== */
const CATEGORY_META: Record<string, { label: string; labelAr: string; icon: React.ElementType; gradient: string }> = {
  hotel:      { label: "Hotel",      labelAr: "فندق",     icon: Hotel,            gradient: "from-blue-500 to-blue-600" },
  attraction: { label: "Attraction", labelAr: "معلم سياحي", icon: Landmark,         gradient: "from-amber-500 to-orange-500" },
  activity:   { label: "Activity",   labelAr: "نشاط",     icon: Bike,             gradient: "from-emerald-500 to-teal-500" },
  transfer:   { label: "Transfer",   labelAr: "تنقل",     icon: Car,              gradient: "from-purple-500 to-violet-500" },
  meal:       { label: "Meal",       labelAr: "وجبة",     icon: UtensilsCrossed,  gradient: "from-rose-500 to-pink-500" },
  guide:      { label: "Guide",      labelAr: "مرشد",     icon: UserCheck,        gradient: "from-cyan-500 to-sky-500" },
  template:   { label: "Template",   labelAr: "نموذج",    icon: FileText,         gradient: "from-slate-500 to-gray-500" },
};

// Available languages with their display info
const LANGUAGE_INFO: Record<string, { label: string; nativeLabel: string; flag: string; rtl: boolean }> = {
  en: { label: "English", nativeLabel: "English", flag: "🇬🇧", rtl: false },
  ar: { label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦", rtl: true },
  ja: { label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵", rtl: false },
  es: { label: "Spanish", nativeLabel: "Español", flag: "🇪🇸", rtl: false },
  fr: { label: "French", nativeLabel: "Français", flag: "🇫🇷", rtl: false },
  zh: { label: "Chinese", nativeLabel: "中文", flag: "🇨🇳", rtl: false },
};

const getTimeIcon = (time: string | null) => {
  if (!time) return Sun;
  const h = parseInt(time.split(":")[0]);
  if (h < 6) return Moon;
  if (h < 12) return Sunrise;
  if (h < 17) return Sun;
  return Sunset;
};

const formatDuration = (m: number | null) => {
  if (!m) return null;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};

const FEEDBACK_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  comment:         { icon: MessageCircle, color: "text-blue-600", bg: "bg-blue-50" },
  approval:        { icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-50" },
  change_request:  { icon: RefreshCw,     color: "text-amber-600", bg: "bg-amber-50" },
};

/* ====== COMPONENT ====== */
export default function SharedBooking() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lang, setLang] = useState<string>("en");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"comment" | "approval" | "change_request">("comment");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordUnlocked, setPasswordUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  
  const isRtl = LANGUAGE_INFO[lang]?.rtl ?? false;

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    return () => { document.documentElement.dir = "ltr"; };
  }, [isRtl]);

  // Static UI strings - these are hardcoded for basic UI
  const t = useMemo(() => {
    const strings: Record<string, Record<string, string>> = {
      en: {
        itinerary: "Your Itinerary",
        days: "days",
        adults: "Adults",
        children: "Children",
        day: "Day",
        totalPrice: "Trip Total",
        perPerson: "per person",
        duration: "Duration",
        loading: "Loading your itinerary...",
        notFound: "Itinerary Not Found",
        notFoundDesc: "This itinerary link may have expired or is invalid.",
        services: "Services",
        noServices: "Free day — explore at your leisure",
        feedback: "Share Your Feedback",
        approve: "Approve Itinerary",
        requestChanges: "Request Changes",
        comment: "Leave a Comment",
        yourName: "Your Name",
        yourEmail: "Email (optional)",
        yourMessage: "Your message...",
        send: "Send",
        sending: "Sending...",
        feedbackSent: "Thank you! Your feedback has been submitted.",
        approvalSent: "Trip approved! Thank you for your confirmation.",
        changesSent: "Change request sent. Your agent will review it shortly.",
        feedbackTimeline: "Conversation",
        noFeedback: "No comments yet",
        approveDesc: "Confirm that you're happy with this itinerary",
        changesDesc: "Let your agent know what you'd like changed",
        commentDesc: "Share any thoughts or questions",
        pickup: "Pickup",
        dropoff: "Drop-off",
        selectLanguage: "Select Language",
      },
      ar: {
        itinerary: "برنامج رحلتك",
        days: "أيام",
        adults: "بالغين",
        children: "أطفال",
        day: "اليوم",
        totalPrice: "إجمالي الرحلة",
        perPerson: "للشخص",
        duration: "المدة",
        loading: "جاري تحميل برنامج رحلتك...",
        notFound: "لم يتم العثور على البرنامج",
        notFoundDesc: "قد يكون رابط البرنامج منتهي الصلاحية أو غير صالح.",
        services: "الخدمات",
        noServices: "يوم حر — استمتع بوقتك",
        feedback: "شاركنا رأيك",
        approve: "الموافقة على البرنامج",
        requestChanges: "طلب تعديلات",
        comment: "أضف تعليقاً",
        yourName: "اسمك",
        yourEmail: "البريد الإلكتروني (اختياري)",
        yourMessage: "رسالتك...",
        send: "إرسال",
        sending: "جاري الإرسال...",
        feedbackSent: "شكراً! تم إرسال ملاحظاتك.",
        approvalSent: "تمت الموافقة! شكراً لتأكيدك.",
        changesSent: "تم إرسال طلب التعديل. سيراجعه وكيلك قريباً.",
        feedbackTimeline: "المحادثة",
        noFeedback: "لا توجد تعليقات بعد",
        approveDesc: "أكد أنك راضٍ عن هذا البرنامج",
        changesDesc: "أخبر وكيلك بما تريد تغييره",
        commentDesc: "شارك أي أفكار أو أسئلة",
        pickup: "نقطة الالتقاط",
        dropoff: "نقطة الإنزال",
        selectLanguage: "اختر اللغة",
      },
    };
    return strings[lang] || strings.en;
  }, [lang]);

  // Fetch share token → booking
  const { data: shareToken, isLoading: tokenLoading } = useQuery({
    queryKey: ["booking-share-token", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_share_tokens")
        .select("*")
        .eq("token", token!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ["shared-booking", shareToken?.booking_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", shareToken!.booking_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!shareToken?.booking_id,
  });

  const { data: company } = useQuery({
    queryKey: ["shared-booking-company", booking?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("name, logo_url, email, phone")
        .eq("id", booking!.company_id)
        .single();
      return data;
    },
    enabled: !!booking?.company_id,
  });

  const { data: settings } = useQuery({
    queryKey: ["shared-booking-settings", booking?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("logo_url, tagline, website")
        .eq("company_id", booking!.company_id)
        .single();
      return data;
    },
    enabled: !!booking?.company_id,
  });

  const { data: days = [] } = useQuery({
    queryKey: ["shared-booking-days", booking?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_days")
        .select("*, booking_day_items(*)")
        .eq("booking_id", booking!.id)
        .order("day_number");
      if (error) throw error;
      return data as BookingDay[];
    },
    enabled: !!booking?.id,
  });

  const { data: feedbackList = [] } = useQuery({
    queryKey: ["shared-booking-feedback", booking?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_feedback")
        .select("*")
        .eq("booking_id", booking!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as BookingFeedback[];
    },
    enabled: !!booking?.id,
  });

  const submitFeedback = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("booking_feedback").insert({
        booking_id: booking!.id,
        feedback_type: feedbackType,
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        message: feedbackMessage.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-booking-feedback", booking?.id] });
      const msg = feedbackType === "approval" ? t.approvalSent : feedbackType === "change_request" ? t.changesSent : t.feedbackSent;
      toast({ title: msg });
      setFeedbackMessage("");
      setFeedbackType("comment");
      setFeedbackOpen(false);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (days.length > 0 && expandedDays.size === 0) {
      setExpandedDays(new Set(days.map(d => d.id)));
    }
  }, [days]);

  const toggleDay = (dayId: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayId)) next.delete(dayId);
      else next.add(dayId);
      return next;
    });
  };

  const logoUrl = settings?.logo_url || company?.logo_url;
  const companyName = company?.name;
  const tagline = settings?.tagline;
  const isLoading = tokenLoading || bookingLoading;

  // Extract metadata for translations (before any returns)
  const metadata = shareToken?.metadata as { 
    password_hash?: string;
    translations?: Record<string, any>;
    available_languages?: string[];
  } | null;
  const isPasswordProtected = !!metadata?.password_hash;
  const availableLanguages = metadata?.available_languages || ["en", "ar"];
  const translations = metadata?.translations || {};

  // Get translated content based on selected language (useMemo must be before returns)
  const getTranslatedContent = useMemo(() => {
    if (lang === "en" || !translations[lang]) {
      return null; // Use original content
    }
    return translations[lang];
  }, [lang, translations]);

  // Helper to get translated text
  const getTranslatedText = (original: string | null | undefined, path: string): string => {
    if (!original) return "";
    if (lang === "en") return original;
    
    const translated = getTranslatedContent;
    if (!translated) return original;
    
    // Parse the path to get the value (e.g., "title" or "days.0.title")
    const parts = path.split(".");
    let value: any = translated;
    for (const part of parts) {
      if (value && typeof value === "object") {
        value = value[part];
      } else {
        return original;
      }
    }
    return typeof value === "string" ? value : original;
  };

  // Hash password for comparison
  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) return;
    if (!metadata?.password_hash) {
      setPasswordUnlocked(true);
      return;
    }
    const inputHash = await hashPassword(passwordInput.trim());
    if (inputHash === metadata.password_hash) {
      setPasswordUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  /* ====== LOADING ====== */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl gold-gradient animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Compass className="w-8 h-8 text-accent-foreground animate-spin" style={{ animationDuration: "3s" }} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t.loading}</p>
        </motion.div>
      </div>
    );
  }

  /* ====== NOT FOUND ====== */
  if (!booking || !shareToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold font-display text-foreground mb-2">{t.notFound}</h1>
          <p className="text-sm text-muted-foreground">{t.notFoundDesc}</p>
        </motion.div>
      </div>
    );
  }

  /* ====== PASSWORD GATE ====== */
  if (isPasswordProtected && !passwordUnlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm w-full"
        >
          <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-accent-foreground" />
          </div>
          <h1 className="text-xl font-bold font-display text-foreground mb-2">
            {lang === "ar" ? "محمي بكلمة مرور" : "Password Protected"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {lang === "ar" 
              ? "هذا البرنامج محمي. أدخل كلمة المرور للمتابعة."
              : "This itinerary is protected. Enter the password to continue."
            }
          </p>
          
          <div className="space-y-4">
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                placeholder={lang === "ar" ? "كلمة المرور" : "Enter password"}
                className={cn(
                  "pe-10 h-12 text-center text-lg",
                  passwordError && "border-destructive"
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute end-0 top-0 h-full w-12"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            
            {passwordError && (
              <p className="text-sm text-destructive">
                {lang === "ar" ? "كلمة المرور غير صحيحة" : "Incorrect password"}
              </p>
            )}
            
            <Button
              onClick={handlePasswordSubmit}
              className="w-full h-11 gold-gradient text-accent-foreground font-semibold"
            >
              {lang === "ar" ? "فتح" : "Unlock"}
            </Button>
          </div>

          <button
            onClick={() => setShowLangPicker(true)}
            className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all text-xs"
          >
            <Globe className="w-3.5 h-3.5" />
            {LANGUAGE_INFO[lang]?.nativeLabel || "English"}
          </button>
        </motion.div>
      </div>
    );
  }

  const sellingPrice = booking.selling_price || 0;
  const totalPax = (booking.adults || 1) + (booking.children || 0);
  const perPerson = totalPax > 0 ? Math.round(sellingPrice / totalPax) : 0;
  const hasApproval = feedbackList.some(f => f.feedback_type === "approval");

  /* ====== RENDER ====== */
  return (
    <div className={cn("min-h-screen bg-background", isRtl && "font-display")}>

      {/* ===== HERO HEADER ===== */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 navy-gradient" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative max-w-4xl mx-auto px-6 pt-8 pb-12 md:pt-12 md:pb-16">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between mb-10"
          >
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName || ""} className="h-8 w-auto object-contain rounded" />
              ) : (
                <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center">
                  <Compass className="w-5 h-5 text-accent-foreground" />
                </div>
              )}
              {companyName && (
                <div>
                  <span className="text-sm font-semibold text-primary-foreground">{companyName}</span>
                  {tagline && <p className="text-[10px] text-primary-foreground/50">{tagline}</p>}
                </div>
              )}
            </div>
            {/* Language Picker */}
            <div className="relative">
              <button
                onClick={() => setShowLangPicker(!showLangPicker)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary-foreground/20 text-primary-foreground/70 hover:text-primary-foreground hover:border-primary-foreground/40 transition-all text-xs"
              >
                <span>{LANGUAGE_INFO[lang]?.flag || "🌐"}</span>
                <span>{LANGUAGE_INFO[lang]?.nativeLabel || "English"}</span>
                <Globe className="w-3.5 h-3.5" />
              </button>
              
              {showLangPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full mt-2 end-0 bg-card border border-border rounded-xl shadow-lg py-2 min-w-[180px] z-50"
                >
                  <div className="px-3 py-2 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground">{t.selectLanguage}</span>
                  </div>
                  {availableLanguages.map((langCode) => {
                    const langInfo = LANGUAGE_INFO[langCode];
                    if (!langInfo) return null;
                    const isSelected = lang === langCode;
                    return (
                      <button
                        key={langCode}
                        onClick={() => { setLang(langCode); setShowLangPicker(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-start",
                          isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <span className="text-lg">{langInfo.flag}</span>
                        <div className="flex-1">
                          <span className="font-medium">{langInfo.nativeLabel}</span>
                          <span className="text-xs text-muted-foreground ms-1">({langInfo.label})</span>
                        </div>
                        {isSelected && <CheckCircle className="w-4 h-4 text-primary" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display text-primary-foreground leading-tight mb-4">
              {booking.title}
            </h1>
            {booking.description && (
              <p className="text-sm md:text-base text-primary-foreground/60 max-w-xl leading-relaxed mb-6">
                {booking.description}
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-wrap gap-3"
          >
            <MetaChip icon={Calendar} text={`${booking.total_days} ${t.days}`} />
            <MetaChip icon={Users} text={`${booking.adults} ${t.adults}${booking.children > 0 ? ` · ${booking.children} ${t.children}` : ""}`} />
            {booking.start_date && (
              <MetaChip icon={Calendar} text={`${format(new Date(booking.start_date), "MMM d")}${booking.end_date ? ` → ${format(new Date(booking.end_date), "MMM d, yyyy")}` : ""}`} />
            )}
            {hasApproval && (
              <MetaChip icon={CheckCircle} text={lang === "en" ? "Approved" : "تمت الموافقة"} />
            )}
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" className="w-full h-8 md:h-12" preserveAspectRatio="none">
            <path d="M0 48h1440V16C1200 40 960 0 720 24S240 56 0 16v32z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </header>

      {/* ===== ITINERARY BODY ===== */}
      <main className="max-w-4xl mx-auto px-6 py-8 md:py-12">
        <div className="space-y-6">
          {days.map((day, dayIdx) => {
            const dayItems = (day.booking_day_items || []).sort((a, b) => a.sort_order - b.sort_order);
            const isExpanded = expandedDays.has(day.id);

            return (
              <motion.div
                key={day.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dayIdx * 0.08, duration: 0.5 }}
                className="group"
              >
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                  <button
                    onClick={() => toggleDay(day.id)}
                    className="w-full text-left p-5 md:p-6 flex items-start gap-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="shrink-0">
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl gold-gradient flex flex-col items-center justify-center shadow-lg">
                        <span className="text-[10px] uppercase tracking-widest text-accent-foreground/70 font-medium">{t.day}</span>
                        <span className="text-xl md:text-2xl font-bold text-accent-foreground leading-none">{day.day_number}</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 pt-1">
                      <h2 className="text-lg md:text-xl font-bold font-display text-foreground mb-1">
                        {day.title || `${t.day} ${day.day_number}`}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {day.city && (
                          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {day.city}</span>
                        )}
                        {day.date && (
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {format(new Date(day.date), "EEEE, MMM d")}</span>
                        )}
                        <span>{dayItems.length} {t.services}</span>
                      </div>
                      {(day.short_description || day.description) && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{day.short_description || day.description}</p>
                      )}
                      {(day.pickup_location || day.dropoff_location) && (
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          {day.pickup_location && (
                            <span className="flex items-center gap-1">📍 {t.pickup}: {day.pickup_location} {day.pickup_time && `@ ${day.pickup_time}`}</span>
                          )}
                          {day.dropoff_location && (
                            <span className="flex items-center gap-1">🏁 {t.dropoff}: {day.dropoff_location}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 pt-2">
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 md:px-6 md:pb-6">
                          {dayItems.length === 0 ? (
                            <div className="text-center py-6 text-sm text-muted-foreground italic">{t.noServices}</div>
                          ) : (
                            <div className="space-y-3">
                              {dayItems.map((item, itemIdx) => {
                                const meta = CATEGORY_META[item.category] || CATEGORY_META.activity;
                                const Icon = meta.icon;
                                const TimeIcon = getTimeIcon(item.start_time);

                                return (
                                  <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: isRtl ? 12 : -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: itemIdx * 0.05, duration: 0.35 }}
                                    className="flex gap-3 md:gap-4"
                                  >
                                    <div className="flex flex-col items-center shrink-0 pt-1">
                                      <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm", meta.gradient)}>
                                        <Icon className="w-4 h-4 text-white" />
                                      </div>
                                      {itemIdx < dayItems.length - 1 && (
                                        <div className="w-px flex-1 bg-border mt-2 min-h-[16px]" />
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0 pb-4">
                                      <div className="rounded-xl border border-border bg-background p-4 hover:border-accent/30 transition-colors duration-200">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground">{item.custom_title}</h3>
                                            {item.custom_description && (
                                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{item.custom_description}</p>
                                            )}
                                          </div>
                                          <Badge variant="outline" className="shrink-0 text-[10px] capitalize border-border">
                                            {lang === "ar" ? meta.labelAr : meta.label}
                                          </Badge>
                                        </div>
                                        {(item.start_time || item.duration_minutes) && (
                                          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                                            {item.start_time && (
                                              <span className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
                                                <TimeIcon className="w-3 h-3" /> {item.start_time}
                                              </span>
                                            )}
                                            {item.duration_minutes && (
                                              <span className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1">
                                                <Clock className="w-3 h-3" /> {formatDuration(item.duration_minutes)}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ===== PRICING ===== */}
        {sellingPrice > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-12"
          >
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="navy-gradient p-8 md:p-10 text-center">
                <span className="text-xs uppercase tracking-[0.2em] text-primary-foreground/50 font-medium">{t.totalPrice}</span>
                <div className="mt-3 flex items-baseline justify-center gap-2">
                  <span className="text-4xl md:text-5xl font-bold font-display text-primary-foreground">{sellingPrice.toLocaleString()}</span>
                  <span className="text-lg text-primary-foreground/50 font-medium">{booking.currency}</span>
                </div>
                {perPerson > 0 && totalPax > 1 && (
                  <p className="mt-2 text-xs text-primary-foreground/40">{perPerson.toLocaleString()} {booking.currency} {t.perPerson}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Client Notes */}
        {booking.client_notes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-8 rounded-2xl border border-border bg-card p-6 md:p-8"
          >
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{booking.client_notes}</p>
          </motion.div>
        )}

        {/* ===== CLIENT FEEDBACK SECTION ===== */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mt-12"
        >
          <Separator className="mb-10" />

          <div className="text-center mb-8">
            <h2 className="text-xl md:text-2xl font-bold font-display text-foreground mb-2">{t.feedback}</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {lang === "en" ? "Review the itinerary above and let us know your thoughts" : "راجع البرنامج أعلاه وأخبرنا برأيك"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-8">
            <button
              onClick={() => { setFeedbackType("approval"); setFeedbackOpen(true); }}
              className={cn(
                "rounded-xl border-2 p-5 text-center transition-all duration-200 hover:shadow-md group",
                hasApproval ? "border-emerald-300 bg-emerald-50/50" : "border-border hover:border-emerald-300 bg-card"
              )}
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{t.approve}</h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{t.approveDesc}</p>
            </button>

            <button
              onClick={() => { setFeedbackType("change_request"); setFeedbackOpen(true); }}
              className="rounded-xl border-2 border-border hover:border-amber-300 bg-card p-5 text-center transition-all duration-200 hover:shadow-md group"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <RefreshCw className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{t.requestChanges}</h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{t.changesDesc}</p>
            </button>

            <button
              onClick={() => { setFeedbackType("comment"); setFeedbackOpen(true); }}
              className="rounded-xl border-2 border-border hover:border-blue-300 bg-card p-5 text-center transition-all duration-200 hover:shadow-md group"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{t.comment}</h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{t.commentDesc}</p>
            </button>
          </div>

          {/* Feedback Form */}
          <AnimatePresence>
            {feedbackOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="max-w-lg mx-auto rounded-2xl border border-border bg-card p-6 mb-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    {(() => {
                      const fb = FEEDBACK_ICONS[feedbackType] || FEEDBACK_ICONS.comment;
                      const FbIcon = fb.icon;
                      return (
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", fb.bg)}>
                          <FbIcon className={cn("w-4 h-4", fb.color)} />
                        </div>
                      );
                    })()}
                    <h3 className="text-sm font-semibold text-foreground">
                      {feedbackType === "approval" ? t.approve : feedbackType === "change_request" ? t.requestChanges : t.comment}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t.yourName} *</Label>
                        <Input
                          value={clientName}
                          onChange={e => setClientName(e.target.value)}
                          placeholder={lang === "en" ? "John Doe" : "محمد أحمد"}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{t.yourEmail}</Label>
                        <Input
                          type="email"
                          value={clientEmail}
                          onChange={e => setClientEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="text-sm"
                        />
                      </div>
                    </div>
                    {feedbackType !== "approval" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">{lang === "en" ? "Message" : "الرسالة"} *</Label>
                        <Textarea
                          value={feedbackMessage}
                          onChange={e => setFeedbackMessage(e.target.value)}
                          placeholder={t.yourMessage}
                          rows={3}
                          className="text-sm resize-none"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <Button
                        onClick={() => submitFeedback.mutate()}
                        disabled={
                          !clientName.trim() ||
                          (feedbackType !== "approval" && !feedbackMessage.trim()) ||
                          submitFeedback.isPending
                        }
                        className="gold-gradient text-accent-foreground gap-2"
                      >
                        {submitFeedback.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {submitFeedback.isPending ? t.sending : t.send}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setFeedbackOpen(false)}>
                        {lang === "en" ? "Cancel" : "إلغاء"}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feedback Timeline */}
          {feedbackList.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 text-center">
                {t.feedbackTimeline}
              </h3>
              <div className="space-y-3">
                {feedbackList.map((fb, fbIdx) => {
                  const meta = FEEDBACK_ICONS[fb.feedback_type] || FEEDBACK_ICONS.comment;
                  const FbIcon = meta.icon;

                  return (
                    <motion.div
                      key={fb.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: fbIdx * 0.05, duration: 0.3 }}
                      className="flex gap-3"
                    >
                      <div className="flex flex-col items-center shrink-0">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", meta.bg)}>
                          <FbIcon className={cn("w-3.5 h-3.5", meta.color)} />
                        </div>
                        {fbIdx < feedbackList.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-4">
                        <div className="rounded-xl border border-border bg-card p-4">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{fb.client_name}</span>
                              <Badge variant="outline" className="text-[10px] capitalize">{fb.feedback_type.replace("_", " ")}</Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {format(new Date(fb.created_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                          {fb.message && (
                            <p className="text-xs text-muted-foreground leading-relaxed mt-1 whitespace-pre-line">{fb.message}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName || ""} className="h-5 w-auto object-contain rounded" />
            ) : (
              <div className="w-6 h-6 rounded gold-gradient flex items-center justify-center">
                <Compass className="w-3 h-3 text-accent-foreground" />
              </div>
            )}
            {companyName && <span className="text-xs font-semibold text-foreground">{companyName}</span>}
          </div>
          {company?.email && <p className="text-[10px] text-muted-foreground">{company.email}</p>}
          {company?.phone && <p className="text-[10px] text-muted-foreground">{company.phone}</p>}
        </div>
      </footer>
    </div>
  );
}

/* ====== SUB-COMPONENTS ====== */
function MetaChip({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 text-xs text-primary-foreground/70">
      <Icon className="w-3.5 h-3.5" />
      {text}
    </div>
  );
}
