import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass, MapPin, Calendar, Users, Clock, Globe,
  Hotel, Landmark, Bike, Car, UtensilsCrossed, UserCheck,
  FileText, ChevronDown, ChevronRight, Loader2, AlertCircle,
  Sun, Moon, Sunrise, Sunset,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

/* ====== TYPES ====== */
interface TripDay {
  id: string;
  day_number: number;
  title: string | null;
  description: string | null;
  city: string | null;
  date: string | null;
}

interface TripDayItem {
  id: string;
  trip_day_id: string;
  custom_title: string | null;
  custom_description: string | null;
  category: string;
  sort_order: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  duration_minutes: number | null;
  start_time: string | null;
  notes: string | null;
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

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ====== COMPONENT ====== */
export default function SharedTrip() {
  const { token } = useParams<{ token: string }>();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const isRtl = lang === "ar";

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    return () => { document.documentElement.dir = "ltr"; };
  }, [isRtl]);

  // Fetch trip by share_token
  const { data: trip, isLoading, error } = useQuery({
    queryKey: ["shared-trip", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("share_token", token!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  // Fetch company info
  const { data: company } = useQuery({
    queryKey: ["shared-trip-company", trip?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("name, logo_url, email, phone")
        .eq("id", trip!.company_id)
        .single();
      return data;
    },
    enabled: !!trip?.company_id,
  });

  // Fetch company settings for branding
  const { data: settings } = useQuery({
    queryKey: ["shared-trip-settings", trip?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("logo_url, tagline, website")
        .eq("company_id", trip!.company_id)
        .single();
      return data;
    },
    enabled: !!trip?.company_id,
  });

  // Fetch days
  const { data: days = [] } = useQuery({
    queryKey: ["shared-trip-days", trip?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_days")
        .select("*")
        .eq("trip_id", trip!.id)
        .order("day_number");
      if (error) throw error;
      return data as TripDay[];
    },
    enabled: !!trip?.id,
  });

  // Fetch all items
  const { data: allItems = [] } = useQuery({
    queryKey: ["shared-trip-items", trip?.id],
    queryFn: async () => {
      const dayIds = days.map(d => d.id);
      if (dayIds.length === 0) return [];
      const { data, error } = await supabase
        .from("trip_day_items")
        .select("*")
        .in("trip_day_id", dayIds)
        .order("sort_order");
      if (error) throw error;
      return data as TripDayItem[];
    },
    enabled: days.length > 0,
  });

  // Expand all days on first load
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

  const t = useMemo(() => {
    const strings = {
      en: {
        itinerary: "Your Itinerary",
        days: "days",
        adults: "Adults",
        children: "Children",
        day: "Day",
        totalPrice: "Trip Total",
        perPerson: "per person",
        duration: "Duration",
        poweredBy: "Powered by",
        loading: "Loading your itinerary...",
        notFound: "Itinerary Not Found",
        notFoundDesc: "This itinerary link may have expired or is invalid.",
        services: "Services",
        noServices: "Free day — explore at your leisure",
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
        poweredBy: "مدعوم من",
        loading: "جاري تحميل برنامج رحلتك...",
        notFound: "لم يتم العثور على البرنامج",
        notFoundDesc: "قد يكون رابط البرنامج منتهي الصلاحية أو غير صالح.",
        services: "الخدمات",
        noServices: "يوم حر — استمتع بوقتك",
      },
    };
    return strings[lang];
  }, [lang]);

  /* ====== LOADING STATE ====== */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
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

  /* ====== ERROR / NOT FOUND ====== */
  if (error || !trip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold font-display text-foreground mb-2">{t.notFound}</h1>
          <p className="text-sm text-muted-foreground">{t.notFoundDesc}</p>
        </motion.div>
      </div>
    );
  }

  const sellingPrice = trip.selling_price || 0;
  const totalPax = (trip.adults || 1) + (trip.children || 0);
  const perPerson = totalPax > 0 ? Math.round(sellingPrice / totalPax) : 0;

  /* ====== MAIN RENDER ====== */
  return (
    <div className={cn("min-h-screen bg-background", isRtl && "font-display")}>

      {/* ===== HERO HEADER ===== */}
      <header className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 navy-gradient" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="relative max-w-4xl mx-auto px-6 pt-8 pb-12 md:pt-12 md:pb-16">
          {/* Language toggle + Company branding */}
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
            <button
              onClick={() => setLang(l => l === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary-foreground/20 text-primary-foreground/70 hover:text-primary-foreground hover:border-primary-foreground/40 transition-all text-xs"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === "en" ? "العربية" : "English"}
            </button>
          </motion.div>

          {/* Trip title & meta */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display text-primary-foreground leading-tight mb-4">
              {trip.title}
            </h1>
            {trip.description && (
              <p className="text-sm md:text-base text-primary-foreground/60 max-w-xl leading-relaxed mb-6">
                {trip.description}
              </p>
            )}
          </motion.div>

          {/* Meta chips */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-wrap gap-3"
          >
            <MetaChip icon={Calendar} text={`${trip.total_days} ${t.days}`} />
            <MetaChip icon={Users} text={`${trip.adults} ${t.adults}${trip.children > 0 ? ` · ${trip.children} ${t.children}` : ""}`} />
            {trip.start_date && (
              <MetaChip icon={Calendar} text={`${format(new Date(trip.start_date), "MMM d")}${trip.end_date ? ` → ${format(new Date(trip.end_date), "MMM d, yyyy")}` : ""}`} />
            )}
          </motion.div>
        </div>

        {/* Decorative wave bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" className="w-full h-8 md:h-12" preserveAspectRatio="none">
            <path d="M0 48h1440V16C1200 40 960 0 720 24S240 56 0 16v32z" fill="hsl(var(--background))" />
          </svg>
        </div>
      </header>

      {/* ===== ITINERARY BODY ===== */}
      <main className="max-w-4xl mx-auto px-6 py-8 md:py-12">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {days.map((day, dayIdx) => {
            const dayItemsList = allItems.filter(i => i.trip_day_id === day.id).sort((a, b) => a.sort_order - b.sort_order);
            const isExpanded = expandedDays.has(day.id);

            return (
              <motion.div
                key={day.id}
                variants={fadeUp}
                custom={dayIdx}
                className="group"
              >
                {/* Day Card */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                  {/* Day Header */}
                  <button
                    onClick={() => toggleDay(day.id)}
                    className="w-full text-left p-5 md:p-6 flex items-start gap-4 transition-colors hover:bg-muted/30"
                  >
                    {/* Day number badge */}
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
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {day.city}
                          </span>
                        )}
                        {day.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> {format(new Date(day.date), "EEEE, MMM d")}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          {dayItemsList.length} {t.services}
                        </span>
                      </div>
                      {day.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{day.description}</p>
                      )}
                    </div>

                    <div className="shrink-0 pt-2">
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </button>

                  {/* Day Items */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 md:px-6 md:pb-6">
                          {dayItemsList.length === 0 ? (
                            <div className="text-center py-6 text-sm text-muted-foreground italic">
                              {t.noServices}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {dayItemsList.map((item, itemIdx) => {
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
                                    {/* Timeline connector */}
                                    <div className="flex flex-col items-center shrink-0 pt-1">
                                      <div className={cn(
                                        "w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm",
                                        meta.gradient
                                      )}>
                                        <Icon className="w-4 h-4 text-white" />
                                      </div>
                                      {itemIdx < dayItemsList.length - 1 && (
                                        <div className="w-px flex-1 bg-border mt-2 min-h-[16px]" />
                                      )}
                                    </div>

                                    {/* Item content */}
                                    <div className="flex-1 min-w-0 pb-4">
                                      <div className="rounded-xl border border-border bg-background p-4 hover:border-accent/30 transition-colors duration-200">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground">
                                              {item.custom_title}
                                            </h3>
                                            {item.custom_description && (
                                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">
                                                {item.custom_description}
                                              </p>
                                            )}
                                          </div>
                                          <Badge variant="outline" className="shrink-0 text-[10px] capitalize border-border">
                                            {lang === "ar" ? meta.labelAr : meta.label}
                                          </Badge>
                                        </div>

                                        {/* Time / Duration row */}
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
        </motion.div>

        {/* ===== PRICING SUMMARY ===== */}
        {sellingPrice > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-12"
          >
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="navy-gradient p-8 md:p-10 text-center">
                <span className="text-xs uppercase tracking-[0.2em] text-primary-foreground/50 font-medium">
                  {t.totalPrice}
                </span>
                <div className="mt-3 flex items-baseline justify-center gap-2">
                  <span className="text-4xl md:text-5xl font-bold font-display text-primary-foreground">
                    {sellingPrice.toLocaleString()}
                  </span>
                  <span className="text-lg text-primary-foreground/50 font-medium">
                    {trip.currency}
                  </span>
                </div>
                {perPerson > 0 && totalPax > 1 && (
                  <p className="mt-2 text-xs text-primary-foreground/40">
                    {perPerson.toLocaleString()} {trip.currency} {t.perPerson}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Client Notes */}
        {(trip as any).client_notes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-8 rounded-2xl border border-border bg-card p-6 md:p-8"
          >
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {(trip as any).client_notes}
            </p>
          </motion.div>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border py-8 mt-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-6 w-auto object-contain opacity-50" />
            ) : (
              <Compass className="w-4 h-4 text-muted-foreground/40" />
            )}
            {companyName && (
              <span className="text-xs text-muted-foreground/60 font-medium">{companyName}</span>
            )}
          </div>
          {(company?.email || company?.phone) && (
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground/40">
              {company.email && <span>{company.email}</span>}
              {company.phone && <span>{company.phone}</span>}
            </div>
          )}
          {settings?.website && (
            <a
              href={settings.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-accent/50 hover:text-accent transition-colors mt-2 inline-block"
            >
              {settings.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ====== SUB-COMPONENTS ====== */
function MetaChip({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-foreground/10 text-primary-foreground/80 text-xs font-medium backdrop-blur-sm border border-primary-foreground/5">
      <Icon className="w-3.5 h-3.5" />
      {text}
    </span>
  );
}
