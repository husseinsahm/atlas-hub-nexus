import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Calendar, Users, DollarSign, MapPin, Clock, Search,
  Loader2, Save, Share2, Sparkles, ChevronDown, ChevronRight,
  Plane, Sun, Moon, Sunset, Trash2, GripVertical, MoreHorizontal,
  Landmark, Hotel, Bike, Car, UtensilsCrossed, UserCheck,
  Eye, Pencil, FileText, Copy, ExternalLink, Wand2, X,
  TrendingUp, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";

type TripStatus = "draft" | "under_review" | "awaiting_approval" | "approved" | "converted" | "cancelled";

const STATUS_CONFIG: Record<TripStatus, { label: string; color: string; bg: string; next?: TripStatus }> = {
  draft: { label: "Draft", color: "text-slate-700", bg: "bg-slate-100", next: "under_review" },
  under_review: { label: "Under Review", color: "text-amber-700", bg: "bg-amber-50", next: "awaiting_approval" },
  awaiting_approval: { label: "Awaiting Approval", color: "text-orange-700", bg: "bg-orange-50", next: "approved" },
  approved: { label: "Approved", color: "text-emerald-700", bg: "bg-emerald-50", next: "converted" },
  converted: { label: "Converted", color: "text-blue-700", bg: "bg-blue-50" },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-50" },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  attraction: Landmark, hotel: Hotel, activity: Bike, transfer: Car,
  meal: UtensilsCrossed, guide: UserCheck, template: FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
  attraction: "text-amber-600 bg-amber-50",
  hotel: "text-blue-600 bg-blue-50",
  activity: "text-emerald-600 bg-emerald-50",
  transfer: "text-purple-600 bg-purple-50",
  meal: "text-red-600 bg-red-50",
  guide: "text-cyan-600 bg-cyan-50",
  template: "text-orange-600 bg-orange-50",
};

interface TripDay {
  id: string;
  trip_id: string;
  day_number: number;
  title: string | null;
  description: string | null;
  city: string | null;
  date: string | null;
}

interface TripDayItem {
  id: string;
  trip_day_id: string;
  library_item_id: string | null;
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

interface LibraryItem {
  id: string;
  category: string;
  title: string;
  description: string | null;
  city: string | null;
  price_amount: number | null;
  price_currency: string;
  duration_minutes: number | null;
  tags: string[];
}

export default function TripBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [editingTrip, setEditingTrip] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState("all");
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch trip
  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("*, customers(full_name, email, phone)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch days
  const { data: days = [] } = useQuery({
    queryKey: ["trip-days", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_days")
        .select("*")
        .eq("trip_id", id!)
        .order("day_number");
      if (error) throw error;
      return data as TripDay[];
    },
    enabled: !!id,
  });

  // Auto-select first day
  useEffect(() => {
    if (days.length > 0 && !selectedDayId) setSelectedDayId(days[0].id);
  }, [days, selectedDayId]);

  // Fetch items for selected day
  const { data: dayItems = [] } = useQuery({
    queryKey: ["trip-day-items", selectedDayId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_day_items")
        .select("*")
        .eq("trip_day_id", selectedDayId!)
        .order("sort_order");
      if (error) throw error;
      return data as TripDayItem[];
    },
    enabled: !!selectedDayId,
  });

  // Fetch all day items for pricing
  const { data: allDayItems = [] } = useQuery({
    queryKey: ["trip-all-items", id],
    queryFn: async () => {
      const dayIds = days.map(d => d.id);
      if (dayIds.length === 0) return [];
      const { data, error } = await supabase
        .from("trip_day_items")
        .select("*")
        .in("trip_day_id", dayIds);
      if (error) throw error;
      return data as TripDayItem[];
    },
    enabled: days.length > 0,
  });

  // Library items for adding
  const { data: libraryItems = [] } = useQuery({
    queryKey: ["library-items-for-trip", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("library_items")
        .select("id, category, title, description, city, price_amount, price_currency, duration_minutes, tags")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("title");
      if (error) throw error;
      return (data || []).map((d: any) => ({ ...d, tags: Array.isArray(d.tags) ? d.tags : [] })) as LibraryItem[];
    },
    enabled: !!companyId && addItemOpen,
  });

  const filteredLibrary = useMemo(() => {
    let list = libraryItems;
    if (libraryCategoryFilter !== "all") list = list.filter(i => i.category === libraryCategoryFilter);
    if (librarySearch.trim()) {
      const q = librarySearch.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.city?.toLowerCase().includes(q));
    }
    return list;
  }, [libraryItems, libraryCategoryFilter, librarySearch]);

  const selectedDay = days.find(d => d.id === selectedDayId);

  // Pricing calculations
  const pricingSummary = useMemo(() => {
    const totalCost = allDayItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const sellingPrice = trip?.selling_price || 0;
    const profit = sellingPrice - totalCost;
    const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
    const perDay: Record<string, number> = {};
    days.forEach(d => {
      perDay[d.id] = allDayItems.filter(i => i.trip_day_id === d.id).reduce((s, i) => s + (i.total_price || 0), 0);
    });
    return { totalCost, sellingPrice, profit, margin, perDay };
  }, [allDayItems, trip, days]);

  // Mutations
  const updateTrip = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("trips").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip", id] }),
  });

  const updateDay = useMutation({
    mutationFn: async ({ dayId, updates }: { dayId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("trip_days").update(updates).eq("id", dayId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-days", id] }),
  });

  const addDay = useMutation({
    mutationFn: async () => {
      const nextNum = days.length + 1;
      const { error } = await supabase.from("trip_days").insert({
        trip_id: id!,
        day_number: nextNum,
        title: `Day ${nextNum}`,
      });
      if (error) throw error;
      await supabase.from("trips").update({ total_days: nextNum }).eq("id", id!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-days", id] });
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
    },
  });

  const removeDay = useMutation({
    mutationFn: async (dayId: string) => {
      const { error } = await supabase.from("trip_days").delete().eq("id", dayId);
      if (error) throw error;
      // Re-number remaining
      const remaining = days.filter(d => d.id !== dayId).sort((a, b) => a.day_number - b.day_number);
      for (let i = 0; i < remaining.length; i++) {
        await supabase.from("trip_days").update({ day_number: i + 1, title: `Day ${i + 1}` }).eq("id", remaining[i].id);
      }
      await supabase.from("trips").update({ total_days: remaining.length }).eq("id", id!);
    },
    onSuccess: () => {
      if (selectedDayId && !days.find(d => d.id === selectedDayId)) setSelectedDayId(null);
      queryClient.invalidateQueries({ queryKey: ["trip-days", id] });
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
      queryClient.invalidateQueries({ queryKey: ["trip-all-items", id] });
    },
  });

  const addItemFromLibrary = useMutation({
    mutationFn: async (libItem: LibraryItem) => {
      const maxSort = dayItems.length > 0 ? Math.max(...dayItems.map(i => i.sort_order)) + 1 : 0;
      const { error } = await supabase.from("trip_day_items").insert({
        trip_day_id: selectedDayId!,
        library_item_id: libItem.id,
        custom_title: libItem.title,
        custom_description: libItem.description,
        category: libItem.category,
        sort_order: maxSort,
        unit_price: libItem.price_amount || 0,
        total_price: (libItem.price_amount || 0) * (trip?.adults || 1),
        currency: libItem.price_currency || trip?.currency || "USD",
        duration_minutes: libItem.duration_minutes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-day-items", selectedDayId] });
      queryClient.invalidateQueries({ queryKey: ["trip-all-items", id] });
      toast({ title: "Item added to day" });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("trip_day_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-day-items", selectedDayId] });
      queryClient.invalidateQueries({ queryKey: ["trip-all-items", id] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("trip_day_items").update(updates).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip-day-items", selectedDayId] });
      queryClient.invalidateQueries({ queryKey: ["trip-all-items", id] });
    },
  });

  const advanceStatus = useCallback(() => {
    if (!trip) return;
    const next = STATUS_CONFIG[trip.status as TripStatus]?.next;
    if (next) {
      updateTrip.mutate({ status: next });
      toast({ title: `Status updated to ${STATUS_CONFIG[next].label}` });
    }
  }, [trip, updateTrip, toast]);

  // AI: suggest day plan
  const aiSuggestDay = useCallback(async () => {
    if (!selectedDay || !trip) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("library-ai", {
        body: {
          action: "generate_description",
          data: {
            category: "activity",
            title: `Day ${selectedDay.day_number} plan for "${trip.title}"`,
            city: selectedDay.city || "",
            hints: `${trip.adults} adults, ${trip.children} children. This is day ${selectedDay.day_number} of a ${trip.total_days}-day trip. Suggest a one-paragraph description of what to do this day.`,
          },
        },
      });
      if (error) throw error;
      if (data?.result) {
        updateDay.mutate({ dayId: selectedDay.id, updates: { description: data.result } });
        toast({ title: "AI suggestion applied" });
      }
    } catch (e: any) {
      toast({ title: "AI Error", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }, [selectedDay, trip, updateDay, toast]);

  if (tripLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold">Trip not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/trips")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to trips
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[trip.status as TripStatus] || STATUS_CONFIG.draft;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* ===== HEADER ===== */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/trips")} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{trip.trip_number}</span>
                <Badge className={cn("border-0 text-[10px]", sc.bg, sc.color)}>{sc.label}</Badge>
              </div>
              <h1 className="text-lg font-bold font-display text-foreground truncate">{trip.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/trip/${trip.share_token}`); toast({ title: "Share link copied!" }); }}>
                  <Share2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy share link</TooltipContent>
            </Tooltip>
            {sc.next && (
              <Button size="sm" onClick={advanceStatus} className="gold-gradient text-accent-foreground text-xs gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {STATUS_CONFIG[sc.next].label}
              </Button>
            )}
          </div>
        </div>
        {/* Trip meta bar */}
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {trip.total_days} days</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {trip.adults}A {trip.children > 0 ? `${trip.children}C` : ""}</span>
          {(trip as any).customers?.full_name && (
            <span className="flex items-center gap-1 font-medium text-foreground">{(trip as any).customers.full_name}</span>
          )}
          {trip.start_date && <span>{format(new Date(trip.start_date), "MMM d")} → {trip.end_date ? format(new Date(trip.end_date), "MMM d, yyyy") : "..."}</span>}
        </div>
      </div>

      {/* ===== MAIN 3-COL LAYOUT ===== */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Day Sidebar */}
        <div className="w-64 shrink-0 border-r border-border bg-card/50 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trip Days</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addDay.mutate()}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add day</TooltipContent>
            </Tooltip>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {days.map((day) => {
                const dayCost = pricingSummary.perDay[day.id] || 0;
                const itemCount = allDayItems.filter(i => i.trip_day_id === day.id).length;
                const isSelected = selectedDayId === day.id;
                return (
                  <motion.button
                    key={day.id}
                    layout
                    onClick={() => setSelectedDayId(day.id)}
                    className={cn(
                      "w-full text-left rounded-lg p-3 transition-all duration-200 group relative",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold",
                          isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-accent/10 text-accent"
                        )}>
                          {day.day_number}
                        </div>
                        <div>
                          <div className="text-sm font-medium truncate max-w-[120px]">{day.title || `Day ${day.day_number}`}</div>
                          {day.city && (
                            <div className={cn("text-[10px] flex items-center gap-0.5", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                              <MapPin className="w-2.5 h-2.5" /> {day.city}
                            </div>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <button className={cn("opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded", isSelected ? "hover:bg-primary-foreground/20" : "hover:bg-muted-foreground/10")}>
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive text-xs" onClick={e => { e.stopPropagation(); removeDay.mutate(day.id); }}>
                            <Trash2 className="w-3 h-3 mr-1.5" /> Remove day
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className={cn("flex items-center gap-3 mt-1.5 text-[10px]", isSelected ? "text-primary-foreground/60" : "text-muted-foreground")}>
                      <span>{itemCount} items</span>
                      {dayCost > 0 && <span className="font-medium">${dayCost.toLocaleString()}</span>}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* CENTER: Day Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedDay ? (
            <div className="p-6 space-y-5">
              {/* Day header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center text-accent-foreground font-bold">
                    {selectedDay.day_number}
                  </div>
                  <div>
                    <Input
                      value={selectedDay.title || ""}
                      onChange={e => updateDay.mutate({ dayId: selectedDay.id, updates: { title: e.target.value } })}
                      className="border-0 bg-transparent p-0 h-auto text-lg font-bold font-display focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder={`Day ${selectedDay.day_number}`}
                    />
                    <div className="flex items-center gap-2 mt-0.5">
                      <Input
                        value={selectedDay.city || ""}
                        onChange={e => updateDay.mutate({ dayId: selectedDay.id, updates: { city: e.target.value } })}
                        className="border-0 bg-transparent p-0 h-auto text-xs text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 w-32"
                        placeholder="City"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={aiSuggestDay} disabled={aiLoading} className="text-xs gap-1.5">
                        {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        AI Suggest
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Let AI suggest a day plan</TooltipContent>
                  </Tooltip>
                  <Button size="sm" onClick={() => setAddItemOpen(true)} className="gold-gradient text-accent-foreground text-xs gap-1.5">
                    <Plus className="w-3 h-3" /> Add Service
                  </Button>
                </div>
              </div>

              {/* Day description */}
              {selectedDay.description && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 border border-border/50">{selectedDay.description}</p>
              )}

              {/* Day items */}
              {dayItems.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-2 border-dashed border-border rounded-xl p-10 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">No services added</h3>
                  <p className="text-xs text-muted-foreground mb-4">Add items from your product library or create custom entries</p>
                  <Button variant="outline" size="sm" onClick={() => setAddItemOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add from Library
                  </Button>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {dayItems.map((item, idx) => {
                      const Icon = CATEGORY_ICONS[item.category] || FileText;
                      const colorClass = CATEGORY_COLORS[item.category] || "text-gray-600 bg-gray-50";
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <Card className="border-border group hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                {/* Timeline connector */}
                                <div className="flex flex-col items-center gap-1 pt-1">
                                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  {item.start_time && (
                                    <span className="text-[10px] text-muted-foreground font-mono">{item.start_time}</span>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h4 className="text-sm font-semibold text-foreground">{item.custom_title}</h4>
                                      {item.custom_description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.custom_description}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => removeItem.mutate(item.id)}
                                      >
                                        <Trash2 className="w-3 h-3 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    {item.duration_minutes && (
                                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {item.duration_minutes}m</span>
                                    )}
                                    <span className="flex items-center gap-1">Qty: {item.quantity}</span>
                                    <div className="flex items-center gap-1.5 ml-auto">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={item.unit_price}
                                        onChange={e => {
                                          const up = parseFloat(e.target.value) || 0;
                                          updateItem.mutate({ itemId: item.id, updates: { unit_price: up, total_price: up * item.quantity } });
                                        }}
                                        className="w-20 h-7 text-xs text-right"
                                      />
                                      <span className="text-[10px] text-muted-foreground">{item.currency}</span>
                                      <span className="text-xs font-semibold text-foreground ml-1">
                                        = {(item.total_price || 0).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">Select a day to start building</p>
            </div>
          )}
        </div>

        {/* RIGHT: Pricing Panel */}
        <div className="w-72 shrink-0 border-l border-border bg-card/50 flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pricing Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Total Cost</span>
                <span className="text-sm font-semibold text-foreground">{pricingSummary.totalCost.toLocaleString()} {trip.currency}</span>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Selling Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={trip.selling_price || ""}
                  onChange={e => updateTrip.mutate({ selling_price: parseFloat(e.target.value) || 0 })}
                  className="text-right font-semibold"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Profit</span>
                <span className={cn("text-sm font-bold", pricingSummary.profit >= 0 ? "text-emerald-600" : "text-destructive")}>
                  {pricingSummary.profit >= 0 ? "+" : ""}{pricingSummary.profit.toLocaleString()} {trip.currency}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Margin</span>
                <Badge variant="outline" className={cn("text-xs", pricingSummary.margin >= 20 ? "text-emerald-600 border-emerald-200" : pricingSummary.margin >= 0 ? "text-amber-600 border-amber-200" : "text-destructive border-destructive/30")}>
                  <TrendingUp className="w-3 h-3 mr-1" /> {pricingSummary.margin.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </div>

          {/* Per-day breakdown */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Per Day Breakdown</h3>
              {days.map(day => {
                const cost = pricingSummary.perDay[day.id] || 0;
                const items = allDayItems.filter(i => i.trip_day_id === day.id).length;
                return (
                  <div
                    key={day.id}
                    onClick={() => setSelectedDayId(day.id)}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors",
                      selectedDayId === day.id ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded text-[10px] flex items-center justify-center bg-accent/10 text-accent font-bold">
                        {day.day_number}
                      </span>
                      <span className="text-muted-foreground">{items} items</span>
                    </div>
                    <span className="font-medium text-foreground">{cost > 0 ? `${cost.toLocaleString()}` : "—"}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Trip notes */}
          <div className="p-4 border-t border-border">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Internal Notes</Label>
            <Textarea
              value={trip.internal_notes || ""}
              onChange={e => updateTrip.mutate({ internal_notes: e.target.value })}
              placeholder="Trip notes..."
              rows={3}
              className="mt-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Add Item from Library Dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" /> Add from Product Library
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search library..." value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={libraryCategoryFilter} onValueChange={setLibraryCategoryFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(CATEGORY_ICONS).map(([key]) => (
                  <SelectItem key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1)}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredLibrary.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No items found. Add items in the Product Library first.</p>
              ) : (
                filteredLibrary.map(item => {
                  const Icon = CATEGORY_ICONS[item.category] || FileText;
                  const colorClass = CATEGORY_COLORS[item.category] || "text-gray-600 bg-gray-50";
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors group"
                      onClick={() => { addItemFromLibrary.mutate(item); setAddItemOpen(false); }}
                    >
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground truncate">{item.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          {item.city && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{item.city}</span>}
                          {item.duration_minutes && <span>{item.duration_minutes}m</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {item.price_amount != null && item.price_amount > 0 && (
                          <span className="text-sm font-semibold text-foreground">{item.price_amount} {item.price_currency}</span>
                        )}
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
