import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Loader2, MapPin, Clock, ChevronDown, ChevronUp,
  Pencil, Check, X, StickyNote, Route, Car, Hotel, Eye,
  Sparkles, Navigation, FileText, Activity, User, Calendar,
  Wand2, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MultiCityAutocomplete } from "@/components/ui/multi-city-autocomplete";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ItineraryDay {
  id: string;
  day_number: number;
  title: string | null;
  city: string | null;
  date: string | null;
  description: string | null;
  short_description: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  pickup_time: string | null;
  start_time: string | null;
  end_time: string | null;
  internal_notes: string | null;
  booking_day_items: any[];
}

interface ItineraryBuilderProps {
  bookingId: string;
  companyId: string;
  itineraryDays: ItineraryDay[];
  booking: any;
  isArabic: boolean;
}

const GUIDE_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "ru", label: "Russian", flag: "🇷🇺" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
];

const DEFAULT_TITLES: Record<string, string> = {
  activity: "Sightseeing tour & local experience",
  hotel: "Accommodation in 5-star hotel",
  transfer: "Private airport/city transfer",
  guide: "English-speaking tour guide",
};

const DEFAULT_TITLES_AR: Record<string, string> = {
  activity: "جولة سياحية وتجربة محلية",
  hotel: "إقامة في فندق 5 نجوم",
  transfer: "نقل خاص من/إلى المطار أو المدينة",
  guide: "مرشد سياحي يتحدث الإنجليزية",
};

const QUICK_ACTIONS = [
  { type: "activity", label: "Activity", labelAr: "نشاط", icon: Activity, color: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100", desc: "Tour, excursion, experience", descAr: "جولة، رحلة، تجربة" },
  { type: "hotel", label: "Hotel", labelAr: "فندق", icon: Hotel, color: "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100", desc: "Accommodation & stay", descAr: "إقامة وسكن" },
  { type: "transfer", label: "Transfer", labelAr: "نقل", icon: Car, color: "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100", desc: "Airport, city transport", descAr: "مطار، نقل داخلي" },
  { type: "guide", label: "Guide", labelAr: "مرشد", icon: User, color: "text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100", desc: "Select language & add guide", descAr: "اختر اللغة وأضف مرشد" },
];

export function ItineraryBuilder({ bookingId, companyId, itineraryDays, booking, isArabic }: ItineraryBuilderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedDay, setExpandedDay] = useState<string | null>(itineraryDays[0]?.id || null);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [showTransport, setShowTransport] = useState<Record<string, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingDayId, setGeneratingDayId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any[] | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Initialize transport toggle state from existing data
  const hasTransport = useCallback((day: ItineraryDay) => {
    return !!(day.pickup_location || day.dropoff_location || day.pickup_time);
  }, []);

  const addDay = useMutation({
    mutationFn: async () => {
      const nextDay = itineraryDays.length + 1;
      let date: string | null = null;
      if (booking?.arrival_date || booking?.start_date) {
        const startDate = new Date(booking.arrival_date || booking.start_date);
        startDate.setDate(startDate.getDate() + nextDay - 1);
        date = startDate.toISOString().split("T")[0];
      }
      const { error } = await supabase.from("booking_days").insert({
        booking_id: bookingId,
        day_number: nextDay,
        title: `Day ${nextDay}`,
        date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-days", bookingId] });
    },
  });

  const updateDay = useMutation({
    mutationFn: async ({ dayId, updates }: { dayId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("booking_days").update(updates).eq("id", dayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-days", bookingId] });
    },
  });

  const deleteDay = useMutation({
    mutationFn: async (dayId: string) => {
      await supabase.from("booking_day_items").delete().eq("booking_day_id", dayId);
      const { error } = await supabase.from("booking_days").delete().eq("id", dayId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-days", bookingId] });
      toast({ title: isArabic ? "تم حذف اليوم" : "Day removed" });
    },
  });

  const addDayItem = useMutation({
    mutationFn: async ({ dayId, category, title }: { dayId: string; category: string; title?: string }) => {
      const items = itineraryDays.find(d => d.id === dayId)?.booking_day_items || [];
      const defaultTitle = title || (isArabic ? DEFAULT_TITLES_AR[category] : DEFAULT_TITLES[category]) || "";
      const { data, error } = await supabase.from("booking_day_items").insert({
        booking_day_id: dayId,
        category,
        custom_title: defaultTitle,
        sort_order: items.length,
        currency: booking?.currency || "USD",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["booking-days", bookingId] });
      if (data?.id) setEditingItemId(data.id);
    },
  });

  const deleteDayItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("booking_day_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-days", bookingId] });
    },
  });

  const generateItinerary = useCallback(async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-itinerary", {
        body: {
          bookingId,
          title: booking?.title,
          totalDays: booking?.total_days || itineraryDays.length || 7,
          arrivalDate: booking?.arrival_date || booking?.start_date,
          departureDate: booking?.departure_date || booking?.end_date,
          adults: booking?.adults,
          children: booking?.children,
          existingDays: itineraryDays.map(d => ({
            id: d.id,
            day_number: d.day_number,
            city: d.city,
            title: d.title,
            date: d.date,
          })),
        },
      });

      if (error) throw error;

      if (data?.days) {
        setAiSuggestions(data.days);
        toast({ title: isArabic ? "تم توليد الاقتراحات - راجع وأكّد" : "AI suggestions ready — review & confirm below" });
      }
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast({
        title: isArabic ? "فشل التوليد" : "Generation failed",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [bookingId, booking, itineraryDays, queryClient, toast, isArabic]);

  const applyAiSuggestions = useCallback(async () => {
    if (!aiSuggestions) return;
    try {
      for (const day of aiSuggestions) {
        const existingDay = itineraryDays.find(d => d.day_number === day.day_number);
        const updatePayload = {
          title: day.title || null,
          short_description: day.short_description || null,
          city: day.city || null,
          pickup_location: day.pickup_location || null,
          dropoff_location: day.dropoff_location || null,
          pickup_time: day.pickup_time || null,
        };

        if (existingDay) {
          await supabase.from("booking_days").update(updatePayload).eq("id", existingDay.id);
        } else {
          // Calculate date for this day based on arrival date
          let dayDate: string | null = null;
          if (booking?.arrival_date || booking?.start_date) {
            const startDate = new Date(booking.arrival_date || booking.start_date);
            startDate.setDate(startDate.getDate() + (day.day_number - 1));
            dayDate = startDate.toISOString().split("T")[0];
          }

          await supabase.from("booking_days").insert({
            booking_id: bookingId,
            day_number: day.day_number,
            date: dayDate,
            ...updatePayload,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["booking-days", bookingId] });
      toast({ title: isArabic ? "تم تطبيق اقتراحات الذكاء الاصطناعي" : "AI suggestions applied" });
      setAiSuggestions(null);
    } catch (err: any) {
      console.error("Error applying suggestions:", err);
      toast({ title: "Error applying suggestions", description: err?.message, variant: "destructive" });
    }
  }, [aiSuggestions, itineraryDays, bookingId, booking, queryClient, toast, isArabic]);

  const generateSingleDay = useCallback(async (day: ItineraryDay) => {
    setGeneratingDayId(day.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-itinerary", {
        body: {
          bookingId,
          title: booking?.title,
          totalDays: 1,
          arrivalDate: day.date || booking?.arrival_date || booking?.start_date,
          departureDate: day.date || booking?.departure_date || booking?.end_date,
          adults: booking?.adults,
          children: booking?.children,
          existingDays: [{
            id: day.id,
            day_number: day.day_number,
            city: day.city,
            title: day.title,
            date: day.date,
          }],
          singleDay: true,
        },
      });

      if (error) throw error;

      if (data?.days?.[0]) {
        setAiSuggestions([data.days[0]]);
        toast({ title: isArabic ? "اقتراح جاهز - راجع وأكّد" : `AI suggestion for Day ${day.day_number} ready — review & confirm` });
      }
    } catch (err: any) {
      console.error("AI single day error:", err);
      toast({
        title: isArabic ? "فشل التوليد" : "Generation failed",
        description: err?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setGeneratingDayId(null);
    }
  }, [bookingId, booking, toast, isArabic]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center shadow-md">
            <Route className="w-4.5 h-4.5 text-accent-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground font-display">
              {isArabic ? "برنامج الرحلة" : "Trip Itinerary"}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {itineraryDays.length} {isArabic ? "يوم" : "days"} 
              {booking?.arrival_date && ` · ${format(new Date(booking.arrival_date), "MMM d")} → ${booking?.departure_date ? format(new Date(booking.departure_date), "MMM d") : "..."}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {itineraryDays.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[11px] gap-1.5 h-8 border-accent/30 text-accent hover:bg-accent/10"
                  disabled={isGenerating || !!generatingDayId}
                >
                  {(isGenerating || generatingDayId) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {isArabic ? "اقتراحات الذكاء" : "AI Enhance"}
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={generateItinerary} className="gap-2 text-xs">
                  <ListChecks className="w-3.5 h-3.5 text-accent" />
                  <div>
                    <p className="font-medium">{isArabic ? "كل الأيام" : "All Days"}</p>
                    <p className="text-[10px] text-muted-foreground">{isArabic ? "توليد اقتراحات لكل الأيام" : `Generate suggestions for all ${itineraryDays.length} days`}</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem disabled className="gap-2 text-xs opacity-60 pointer-events-none">
                  <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{isArabic ? "يوم محدد" : "Specific Day"}</p>
                    <p className="text-[10px] text-muted-foreground">{isArabic ? "استخدم زر ✨ على كل يوم" : "Use the ✨ button on each day card"}</p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            size="sm"
            className="gold-gradient text-accent-foreground text-[11px] gap-1.5 h-8 shadow-md"
            onClick={() => addDay.mutate()}
            disabled={addDay.isPending}
          >
            <Plus className="w-3.5 h-3.5" /> {isArabic ? "إضافة يوم" : "Add Day"}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {itineraryDays.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
              <Route className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {isArabic ? "لا يوجد برنامج بعد" : "No itinerary yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                {isArabic
                  ? "ابدأ ببناء البرنامج اليومي للرحلة"
                  : "Start building the day-by-day travel plan for this booking"}
              </p>
            </div>
            <Button
              size="sm"
              className="gold-gradient text-accent-foreground text-xs gap-1.5"
              onClick={() => addDay.mutate()}
            >
              <Plus className="w-3.5 h-3.5" /> {isArabic ? "ابدأ البرنامج" : "Start Itinerary"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* AI Suggestions Preview */}
        {aiSuggestions && (
          <Card className="border-accent/30 bg-accent/5 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h4 className="text-sm font-bold text-foreground font-display">
                    {isArabic ? "اقتراحات الذكاء الاصطناعي" : "AI Suggestions"}
                  </h4>
                  <Badge variant="secondary" className="text-[9px]">{aiSuggestions.length} {isArabic ? "يوم" : "days"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setAiSuggestions(null)}>
                    {isArabic ? "تجاهل" : "Dismiss"}
                  </Button>
                  <Button size="sm" className="gold-gradient text-accent-foreground text-xs h-7 gap-1.5" onClick={applyAiSuggestions}>
                    <Check className="w-3 h-3" />
                    {isArabic ? "تطبيق الكل" : "Apply All"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {aiSuggestions.map((s: any) => (
                  <div key={s.day_number} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-background border border-border text-xs">
                    <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-[11px] shrink-0">
                      {s.day_number}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="font-semibold text-foreground truncate">{s.title}</p>
                      {s.short_description && <p className="text-muted-foreground line-clamp-1">{s.short_description}</p>}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {s.city && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{s.city}</span>}
                        {s.pickup_location && <span className="flex items-center gap-0.5"><Navigation className="w-2.5 h-2.5" />{s.pickup_location}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[23px] top-4 bottom-4 w-px bg-border z-0" />

          <div className="space-y-3 relative z-10">
            <AnimatePresence>
              {itineraryDays.map((day, idx) => (
                <DayCard
                  key={day.id}
                  day={day}
                  index={idx}
                  isExpanded={expandedDay === day.id}
                  isEditing={editingDayId === day.id}
                  showTransportFields={showTransport[day.id] ?? hasTransport(day)}
                  isArabic={isArabic}
                  currency={booking?.currency || "USD"}
                  onToggleExpand={() => setExpandedDay(expandedDay === day.id ? null : day.id)}
                  onToggleEdit={() => setEditingDayId(editingDayId === day.id ? null : day.id)}
                  onToggleTransport={(v) => setShowTransport(prev => ({ ...prev, [day.id]: v }))}
                  onUpdateDay={(updates) => updateDay.mutate({ dayId: day.id, updates })}
                  onDeleteDay={() => deleteDay.mutate(day.id)}
                  onAddItem={(category: string, title?: string) => addDayItem.mutate({ dayId: day.id, category, title })}
                  onUpdateItem={async (itemId, updates) => {
                    await supabase.from("booking_day_items").update(updates).eq("id", itemId);
                    queryClient.invalidateQueries({ queryKey: ["booking-days", bookingId] });
                  }}
                  onDeleteItem={(itemId) => deleteDayItem.mutate(itemId)}
                  editingItemId={editingItemId}
                  onSetEditingItemId={setEditingItemId}
                  onAiEnhanceDay={() => generateSingleDay(day)}
                  isAiGenerating={generatingDayId === day.id}
                  isUpdating={updateDay.isPending}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

// ─── Day Card ───

interface DayCardProps {
  day: ItineraryDay;
  index: number;
  isExpanded: boolean;
  isEditing: boolean;
  showTransportFields: boolean;
  isArabic: boolean;
  currency: string;
  onToggleExpand: () => void;
  onToggleEdit: () => void;
  onToggleTransport: (v: boolean) => void;
  onUpdateDay: (updates: Record<string, any>) => void;
  onDeleteDay: () => void;
  onAddItem: (category: string, title?: string) => void;
  onUpdateItem: (itemId: string, updates: Record<string, any>) => void;
  onDeleteItem: (itemId: string) => void;
  onAiEnhanceDay: () => void;
  isAiGenerating: boolean;
  isUpdating: boolean;
  editingItemId: string | null;
  onSetEditingItemId: (id: string | null) => void;
}

function DayCard({
  day, index, isExpanded, isEditing, showTransportFields, isArabic, currency,
  onToggleExpand, onToggleEdit, onToggleTransport, onUpdateDay, onDeleteDay,
  onAddItem, onUpdateItem, onDeleteItem, onAiEnhanceDay, isAiGenerating, isUpdating,
  editingItemId, onSetEditingItemId,
}: DayCardProps) {
  const [localTitle, setLocalTitle] = useState(day.title || "");
  const [localDesc, setLocalDesc] = useState(day.short_description || day.description || "");
  const [localCities, setLocalCities] = useState<string[]>(
    day.city ? day.city.split(",").map(c => c.trim()).filter(Boolean) : []
  );
  const [localPickup, setLocalPickup] = useState(day.pickup_location || "");
  const [localDropoff, setLocalDropoff] = useState(day.dropoff_location || "");
  const [localPickupTime, setLocalPickupTime] = useState(day.pickup_time || "");
  const [localStartTime, setLocalStartTime] = useState(day.start_time || "");
  const [localEndTime, setLocalEndTime] = useState(day.end_time || "");
  const [localNotes, setLocalNotes] = useState(day.internal_notes || "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  const items = (day.booking_day_items || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const itemsTotal = items.reduce((sum: number, i: any) => sum + Number(i.total_price || 0), 0);

  const saveAllFields = useCallback(() => {
    const cityString = localCities.join(", ");
    onUpdateDay({
      title: localTitle || `Day ${day.day_number}`,
      short_description: localDesc || null,
      city: cityString || null,
      pickup_location: showTransportFields ? (localPickup || null) : null,
      dropoff_location: showTransportFields ? (localDropoff || null) : null,
      pickup_time: showTransportFields ? (localPickupTime || null) : null,
      start_time: localStartTime || null,
      end_time: localEndTime || null,
      internal_notes: localNotes || null,
    });
    onToggleEdit();
  }, [localTitle, localDesc, localCities, localPickup, localDropoff, localPickupTime, localStartTime, localEndTime, localNotes, showTransportFields, day.day_number, onUpdateDay, onToggleEdit]);

  const generateDescription = useCallback(async () => {
    setIsGeneratingDesc(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-day-description", {
        body: {
          dayTitle: localTitle || day.title,
          dayNumber: day.day_number,
          cities: localCities.join(", ") || day.city,
          pickupLocation: localPickup || day.pickup_location,
          dropoffLocation: localDropoff || day.dropoff_location,
          items: items.map((i: any) => ({ category: i.category, custom_title: i.custom_title })),
          tripTitle: "",
        },
      });
      if (error) throw error;
      if (data?.description) {
        setLocalDesc(data.description);
      }
    } catch (err: any) {
      console.error("AI description error:", err);
    } finally {
      setIsGeneratingDesc(false);
    }
  }, [localTitle, day, localCities, localPickup, localDropoff, items]);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "hotel": return Hotel;
      case "transfer": return Car;
      case "guide": return User;
      case "activity": return Activity;
      default: return FileText;
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "hotel": return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400";
      case "transfer": return "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400";
      case "guide": return "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400";
      case "activity": return "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Card className={cn(
        "border-border/60 shadow-sm transition-all overflow-hidden",
        isExpanded && "shadow-md border-accent/20",
      )}>
        {/* Day header - always visible */}
        <div
          className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={onToggleExpand}
        >
          {/* Day number badge on timeline */}
          <div className={cn(
            "w-[46px] h-[46px] rounded-xl flex flex-col items-center justify-center shrink-0 font-display shadow-md ring-2 ring-background transition-colors",
            isExpanded ? "gold-gradient text-accent-foreground" : "bg-primary text-primary-foreground"
          )}>
            <span className="text-[9px] font-bold uppercase leading-none opacity-70">
              {isArabic ? "يوم" : "DAY"}
            </span>
            <span className="text-lg font-extrabold leading-none">{day.day_number}</span>
          </div>

          {/* Day info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Inline title */}
              {editingTitle ? (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <Input
                    value={localTitle}
                    onChange={e => setLocalTitle(e.target.value)}
                    className="h-7 text-sm font-bold w-48"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        onUpdateDay({ title: localTitle || `Day ${day.day_number}` });
                        setEditingTitle(false);
                      }
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                    onUpdateDay({ title: localTitle || `Day ${day.day_number}` });
                    setEditingTitle(false);
                  }}>
                    <Check className="w-3 h-3 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingTitle(false)}>
                    <X className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <h4
                  className="text-sm font-bold text-foreground font-display cursor-text hover:text-accent transition-colors"
                  onClick={e => { e.stopPropagation(); setEditingTitle(true); }}
                >
                  {day.title || `Day ${day.day_number}`}
                </h4>
              )}

              {day.city && day.city.split(",").map(c => c.trim()).filter(Boolean).map((city) => (
                <Badge key={city} variant="outline" className="text-[9px] gap-0.5 shrink-0">
                  <MapPin className="w-2.5 h-2.5" /> {city}
                </Badge>
              ))}
              {day.date && (
                <Badge variant="secondary" className="text-[9px] shrink-0">
                  <Calendar className="w-2.5 h-2.5 mr-0.5" />
                  {format(new Date(day.date), "EEE, MMM d")}
                </Badge>
              )}
            </div>

            {/* Short description */}
            {(day.short_description || day.description) && (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                {day.short_description || day.description}
              </p>
            )}

            {/* Transport summary */}
            {(day.pickup_location || day.dropoff_location) && (
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                <Navigation className="w-3 h-3 text-accent shrink-0" />
                <span className="truncate">
                  {day.pickup_location && <span>{day.pickup_location}</span>}
                  {day.pickup_location && day.dropoff_location && <span className="mx-1">→</span>}
                  {day.dropoff_location && <span>{day.dropoff_location}</span>}
                  {day.pickup_time && <span className="ml-1.5 text-accent font-medium">@ {day.pickup_time}</span>}
                </span>
              </div>
            )}

            {/* Items count summary */}
            <div className="flex items-center gap-3 mt-1.5">
              {items.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {items.length} {isArabic ? "عنصر" : "items"}
                </span>
              )}
              {itemsTotal > 0 && (
                <span className="text-[10px] font-mono font-semibold text-foreground">
                  {itemsTotal.toLocaleString()} {currency}
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-accent/70 hover:text-accent"
                  onClick={onAiEnhanceDay}
                  disabled={isAiGenerating}
                >
                  {isAiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">{isArabic ? "اقتراح ذكاء اصطناعي" : "AI Enhance this day"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggleEdit}>
                  <Pencil className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">{isArabic ? "تعديل" : "Edit day"}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={onDeleteDay}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">{isArabic ? "حذف اليوم" : "Delete day"}</TooltipContent>
            </Tooltip>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Separator />

              {/* Edit form */}
              {isEditing && (
                <div className="px-4 py-4 bg-muted/20 border-b border-border space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground font-medium">{isArabic ? "عنوان اليوم" : "Day Title"}</Label>
                      <Input value={localTitle} onChange={e => setLocalTitle(e.target.value)} className="h-9 text-sm mt-1" placeholder="e.g., Pyramids & Sphinx Tour" />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground font-medium">{isArabic ? "المدينة / الوجهة" : "City / Destination"}</Label>
                      <div className="mt-1">
                        <MultiCityAutocomplete
                          value={localCities}
                          onValueChange={setLocalCities}
                          placeholder={isArabic ? "اختر المدن" : "Select cities"}
                          isRtl={isArabic}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase text-muted-foreground font-medium">{isArabic ? "وصف مختصر" : "Short Description"}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] gap-1 text-accent hover:text-accent/80 px-2"
                        onClick={generateDescription}
                        disabled={isGeneratingDesc}
                      >
                        {isGeneratingDesc ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3" />
                        )}
                        {isArabic ? "توليد بالذكاء" : "Generate AI"}
                      </Button>
                    </div>
                    <Textarea value={localDesc} onChange={e => setLocalDesc(e.target.value)} className="text-xs mt-1 resize-none" rows={2} placeholder={isArabic ? "وصف مختصر لنشاطات اليوم..." : "Brief overview of the day's activities..."} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground font-medium">{isArabic ? "وقت البداية" : "Start Time"}</Label>
                      <Input type="time" value={localStartTime} onChange={e => setLocalStartTime(e.target.value)} className="h-9 text-sm mt-1" />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground font-medium">{isArabic ? "وقت النهاية" : "End Time"}</Label>
                      <Input type="time" value={localEndTime} onChange={e => setLocalEndTime(e.target.value)} className="h-9 text-sm mt-1" />
                    </div>
                  </div>

                  {/* Transport toggle */}
                  <div className="rounded-xl border border-border p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-accent" />
                        <span className="text-xs font-medium text-foreground">{isArabic ? "تفاصيل النقل" : "Pickup / Drop-off Details"}</span>
                      </div>
                      <Switch
                        checked={showTransportFields}
                        onCheckedChange={onToggleTransport}
                      />
                    </div>
                    {showTransportFields && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="checkbox"
                            id={`same-location-${day.id}`}
                            checked={localPickup !== "" && localPickup === localDropoff}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setLocalDropoff(localPickup);
                              }
                            }}
                            className="h-3.5 w-3.5 rounded border-border text-accent focus:ring-accent"
                          />
                          <label htmlFor={`same-location-${day.id}`} className="text-[10px] text-muted-foreground cursor-pointer select-none">
                            {isArabic ? "نقطة الإنزال نفس نقطة الالتقاط" : "Drop-off same as Pickup"}
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-[10px] uppercase text-muted-foreground">{isArabic ? "نقطة الالتقاط" : "Pickup Location"}</Label>
                            <Input value={localPickup} onChange={e => {
                              setLocalPickup(e.target.value);
                              if (localPickup === localDropoff || localDropoff === "") {
                                setLocalDropoff(e.target.value);
                              }
                            }} className="h-9 text-sm mt-1" placeholder="e.g., Hotel lobby" />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase text-muted-foreground">{isArabic ? "نقطة الإنزال" : "Drop-off Location"}</Label>
                            <Input
                              value={localDropoff}
                              onChange={e => setLocalDropoff(e.target.value)}
                              className="h-9 text-sm mt-1"
                              placeholder="e.g., Airport Terminal 2"
                              disabled={localPickup !== "" && localPickup === localDropoff}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase text-muted-foreground">{isArabic ? "وقت الالتقاط" : "Pickup Time"}</Label>
                            <Input type="time" value={localPickupTime} onChange={e => setLocalPickupTime(e.target.value)} className="h-9 text-sm mt-1" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Internal notes */}
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1">
                      <StickyNote className="w-3 h-3" /> {isArabic ? "ملاحظات داخلية" : "Internal Notes"}
                    </Label>
                    <Textarea value={localNotes} onChange={e => setLocalNotes(e.target.value)} className="text-xs mt-1 resize-none" rows={2} placeholder={isArabic ? "ملاحظات للفريق فقط..." : "Team-only notes..."} />
                  </div>

                  {/* Save / Cancel */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={onToggleEdit}>
                      {isArabic ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button
                      size="sm"
                      className="gold-gradient text-accent-foreground text-xs gap-1.5 px-5"
                      onClick={saveAllFields}
                      disabled={isUpdating}
                    >
                      {isUpdating && <Loader2 className="w-3 h-3 animate-spin" />}
                      {isArabic ? "حفظ التغييرات" : "Save Changes"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Day items list */}
              <div className="px-4 py-3 space-y-2">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {isArabic ? "لا توجد عناصر - أضف نشاط أو خدمة من الأزرار أدناه" : "No items yet — use the buttons below to add services to this day"}
                  </p>
                ) : (
                  items.map((item: any, i: number) => {
                    const ItemIcon = getCategoryIcon(item.category);
                    const colorClass = getCategoryColor(item.category);
                    const isItemEditing = editingItemId === item.id;
                    return (
                      <DayItemRow
                        key={item.id}
                        item={item}
                        index={i}
                        isEditing={isItemEditing}
                        isArabic={isArabic}
                        ItemIcon={ItemIcon}
                        colorClass={colorClass}
                        onStartEdit={() => onSetEditingItemId(item.id)}
                        onSave={(title) => {
                          onUpdateItem(item.id, { custom_title: title });
                          onSetEditingItemId(null);
                        }}
                        onCancel={() => onSetEditingItemId(null)}
                        onDelete={() => onDeleteItem(item.id)}
                      />
                    );
                  })
                )}

                {/* Quick add buttons */}
                <Separator className="my-2" />
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide px-1">
                  {isArabic ? "إضافة خدمة لهذا اليوم" : "Add a service to this day"}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1 pb-1">
                  {QUICK_ACTIONS.map(qa => {
                    const QIcon = qa.icon;
                    return (
                      <button
                        key={qa.type}
                        className={cn(
                          "flex items-start gap-2.5 rounded-xl border-2 border-dashed px-3 py-3 text-start transition-all hover:scale-[1.01] hover:border-solid hover:shadow-sm cursor-pointer",
                          qa.color,
                        )}
                        onClick={() => onAddItem(qa.type)}
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5")}>
                          <QIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold block">{isArabic ? qa.labelAr : qa.label}</span>
                          <span className="text-[10px] opacity-70 font-normal block mt-0.5">{isArabic ? qa.descAr : qa.desc}</span>
                        </div>
                        <Plus className="w-3.5 h-3.5 shrink-0 opacity-40 mt-1 ms-auto" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

/* Inline-editable day item row */
function DayItemRow({ item, index, isEditing, isArabic, ItemIcon, colorClass, onStartEdit, onSave, onCancel, onDelete }: {
  item: any; index: number; isEditing: boolean; isArabic: boolean;
  ItemIcon: any; colorClass: string;
  onStartEdit: () => void; onSave: (title: string) => void; onCancel: () => void; onDelete: () => void;
}) {
  const [editTitle, setEditTitle] = useState(item.custom_title || "");

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2 p-2.5 rounded-lg border-2 border-primary/30 bg-primary/5"
      >
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border", colorClass)}>
          <ItemIcon className="w-3.5 h-3.5" />
        </div>
        <Input
          autoFocus
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSave(editTitle); if (e.key === "Escape") onCancel(); }}
          placeholder={isArabic ? "اكتب اسم الخدمة..." : "Type service name..."}
          className="h-7 text-xs flex-1"
        />
        <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => onSave(editTitle)}>
          <Check className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onCancel}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="group flex items-center gap-2.5 p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors cursor-pointer"
      onClick={onStartEdit}
    >
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border", colorClass)}>
        <ItemIcon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[8px] capitalize shrink-0 px-1.5">{item.category}</Badge>
          <span className="text-xs font-medium text-foreground truncate">
            {item.custom_title || <span className="italic text-muted-foreground">{isArabic ? "اضغط لتسمية..." : "Click to name..."}</span>}
          </span>
        </div>
        {item.start_time && (
          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" /> {item.start_time}
          </p>
        )}
      </div>
      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
      {Number(item.total_price || 0) > 0 && (
        <span className="text-[11px] font-mono font-semibold text-foreground shrink-0">
          {Number(item.total_price).toLocaleString()} {item.currency}
        </span>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/50 hover:text-destructive shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </motion.div>
  );
}
