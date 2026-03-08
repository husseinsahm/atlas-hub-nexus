import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Calendar, Users, DollarSign, MapPin, Clock, Search,
  Loader2, Share2, Sparkles, Trash2, MoreHorizontal,
  Landmark, Hotel, Bike, Car, UtensilsCrossed, UserCheck,
  Pencil, FileText, Wand2, X,
  TrendingUp, CheckCircle2, Copy, ChevronUp, ChevronDown,
  ArrowUpDown, StickyNote, Image as ImageIcon,
  MoveUp, MoveDown, CopyPlus, MessageSquare,
  Eye, EyeOff, Percent, Tag, Receipt,
  MessageCircle, CheckCircle, RefreshCw,
  History, RotateCcw, GitCommitHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type TripStatus = "draft" | "under_review" | "awaiting_approval" | "approved" | "converted" | "cancelled";

const STATUS_CONFIG: Record<TripStatus, { label: string; color: string; bg: string; next?: TripStatus }> = {
  draft: { label: "Draft", color: "text-slate-700", bg: "bg-slate-100", next: "under_review" },
  under_review: { label: "Under Review", color: "text-amber-700", bg: "bg-amber-50", next: "awaiting_approval" },
  awaiting_approval: { label: "Awaiting Approval", color: "text-orange-700", bg: "bg-orange-50", next: "approved" },
  approved: { label: "Approved", color: "text-emerald-700", bg: "bg-emerald-50", next: "converted" },
  converted: { label: "Converted", color: "text-blue-700", bg: "bg-blue-50" },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-50" },
};

const CATEGORY_META: { value: string; label: string; icon: React.ElementType; color: string }[] = [
  { value: "hotel", label: "Hotel", icon: Hotel, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "attraction", label: "Attraction", icon: Landmark, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "activity", label: "Activity", icon: Bike, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "transfer", label: "Transfer", icon: Car, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "meal", label: "Meal", icon: UtensilsCrossed, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "guide", label: "Guide", icon: UserCheck, color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
  { value: "template", label: "Template", icon: FileText, color: "text-orange-600 bg-orange-50 border-orange-200" },
];

const getCatMeta = (cat: string) => CATEGORY_META.find(c => c.value === cat) || CATEGORY_META[0];

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

const emptyCustomItem = {
  custom_title: "",
  custom_description: "",
  category: "activity",
  start_time: "",
  duration_minutes: "",
  unit_price: "",
  quantity: "1",
  notes: "",
};

export default function TripBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editingItemData, setEditingItemData] = useState<TripDayItem | null>(null);
  const [customForm, setCustomForm] = useState(emptyCustomItem);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState("all");
  const [aiLoading, setAiLoading] = useState(false);
  const [dayNotesOpen, setDayNotesOpen] = useState<string | null>(null);

  // === DATA FETCHING ===
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

  useEffect(() => {
    if (days.length > 0 && !selectedDayId) setSelectedDayId(days[0].id);
  }, [days, selectedDayId]);

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

  // Feedback
  const { data: tripFeedback = [] } = useQuery({
    queryKey: ["trip-feedback", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_feedback")
        .select("*")
        .eq("trip_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; trip_id: string; feedback_type: string; client_name: string; client_email: string | null; message: string | null; status: string; created_at: string }[];
    },
    enabled: !!id,
  });

  // Revisions
  const { data: tripRevisions = [] } = useQuery({
    queryKey: ["trip-revisions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_revisions")
        .select("*")
        .eq("trip_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; trip_id: string; user_id: string | null; revision_number: number; action: string; summary: string; note: string | null; changes: any; snapshot: any; created_at: string }[];
    },
    enabled: !!id,
  });

  const [revisionNote, setRevisionNote] = useState("");

  const trackRevision = useCallback(async (action: string, summary: string, changes: Record<string, any> = {}, note?: string) => {
    if (!id || !user?.id) return;
    const nextNum = (tripRevisions.length > 0 ? tripRevisions[0].revision_number : 0) + 1;
    await supabase.from("trip_revisions").insert({
      trip_id: id,
      user_id: user.id,
      revision_number: nextNum,
      action,
      summary,
      changes,
      note: note || null,
      snapshot: { title: trip?.title, status: trip?.status, total_days: trip?.total_days, selling_price: trip?.selling_price },
    });
    queryClient.invalidateQueries({ queryKey: ["trip-revisions", id] });
  }, [id, user?.id, tripRevisions, trip, queryClient]);

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
    enabled: !!companyId,
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

  // Group items by category for the selected day
  const groupedItems = useMemo(() => {
    const groups: Record<string, TripDayItem[]> = {};
    CATEGORY_META.forEach(c => { groups[c.value] = []; });
    dayItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [dayItems]);

  const [pricingView, setPricingView] = useState<"internal" | "client" | "feedback">("internal");

  const pricingSummary = useMemo(() => {
    const totalCost = allDayItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const markupType = (trip as any)?.markup_type || "percentage";
    const markupValue = (trip as any)?.markup_value || 0;
    const discountType = (trip as any)?.discount_type || "fixed";
    const discountValue = (trip as any)?.discount_value || 0;
    
    // Calculate markup
    let markupAmount = 0;
    if (markupType === "percentage") {
      markupAmount = totalCost * (markupValue / 100);
    } else {
      markupAmount = markupValue;
    }
    
    const subtotalAfterMarkup = totalCost + markupAmount;
    
    // Calculate discount
    let discountAmount = 0;
    if (discountType === "percentage") {
      discountAmount = subtotalAfterMarkup * (discountValue / 100);
    } else {
      discountAmount = discountValue;
    }
    
    const sellingPrice = trip?.selling_price || 0;
    const calculatedClientPrice = subtotalAfterMarkup - discountAmount;
    const profit = sellingPrice - totalCost;
    const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
    
    const perDay: Record<string, number> = {};
    const perDayItems: Record<string, TripDayItem[]> = {};
    days.forEach(d => {
      const items = allDayItems.filter(i => i.trip_day_id === d.id);
      perDay[d.id] = items.reduce((s, i) => s + (i.total_price || 0), 0);
      perDayItems[d.id] = items;
    });
    
    return { totalCost, sellingPrice, profit, margin, perDay, perDayItems, markupAmount, discountAmount, calculatedClientPrice, subtotalAfterMarkup };
  }, [allDayItems, trip, days]);

  // === MUTATIONS ===
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["trip", id] });
    queryClient.invalidateQueries({ queryKey: ["trip-days", id] });
    queryClient.invalidateQueries({ queryKey: ["trip-day-items", selectedDayId] });
    queryClient.invalidateQueries({ queryKey: ["trip-all-items", id] });
  }, [queryClient, id, selectedDayId]);

  const updateTrip = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("trips").update(updates).eq("id", id!);
      if (error) throw error;
      return updates;
    },
    onSuccess: (updates) => {
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
      // Auto-track significant changes
      const keys = Object.keys(updates);
      if (keys.includes("status")) {
        trackRevision("status_change", `Status changed to ${STATUS_CONFIG[updates.status as TripStatus]?.label || updates.status}`, updates);
      } else if (keys.includes("selling_price")) {
        trackRevision("pricing", `Selling price updated to ${updates.selling_price}`, updates);
      } else if (keys.includes("markup_value") || keys.includes("discount_value")) {
        trackRevision("pricing", "Pricing adjustments updated", updates);
      } else if (keys.includes("title")) {
        trackRevision("update", `Trip renamed to "${updates.title}"`, updates);
      }
    },
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
      const { error } = await supabase.from("trip_days").insert({ trip_id: id!, day_number: nextNum, title: `Day ${nextNum}` });
      if (error) throw error;
      await supabase.from("trips").update({ total_days: nextNum }).eq("id", id!);
    },
    onSuccess: () => { invalidateAll(); trackRevision("day_added", `Day ${days.length + 1} added`); },
  });

  const duplicateDay = useMutation({
    mutationFn: async (sourceDayId: string) => {
      const sourceDay = days.find(d => d.id === sourceDayId);
      if (!sourceDay) return;
      const nextNum = days.length + 1;
      // Create new day
      const { data: newDay, error } = await supabase.from("trip_days").insert({
        trip_id: id!,
        day_number: nextNum,
        title: `${sourceDay.title || `Day ${sourceDay.day_number}`} (copy)`,
        city: sourceDay.city,
        description: sourceDay.description,
      }).select().single();
      if (error) throw error;
      // Copy items
      const sourceItems = allDayItems.filter(i => i.trip_day_id === sourceDayId);
      if (sourceItems.length > 0) {
        const copies = sourceItems.map(item => ({
          trip_day_id: newDay.id,
          library_item_id: item.library_item_id,
          custom_title: item.custom_title,
          custom_description: item.custom_description,
          category: item.category,
          sort_order: item.sort_order,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          currency: item.currency,
          duration_minutes: item.duration_minutes,
          start_time: item.start_time,
          notes: item.notes,
        }));
        await supabase.from("trip_day_items").insert(copies);
      }
      await supabase.from("trips").update({ total_days: nextNum }).eq("id", id!);
    },
    onSuccess: () => { invalidateAll(); trackRevision("day_duplicated", "Day duplicated"); toast({ title: "Day duplicated" }); },
  });

  const removeDay = useMutation({
    mutationFn: async (dayId: string) => {
      const { error } = await supabase.from("trip_days").delete().eq("id", dayId);
      if (error) throw error;
      const remaining = days.filter(d => d.id !== dayId).sort((a, b) => a.day_number - b.day_number);
      for (let i = 0; i < remaining.length; i++) {
        await supabase.from("trip_days").update({ day_number: i + 1 }).eq("id", remaining[i].id);
      }
      await supabase.from("trips").update({ total_days: remaining.length }).eq("id", id!);
    },
    onSuccess: () => {
      setSelectedDayId(prev => {
        const idx = days.findIndex(d => d.id === prev);
        if (idx > 0) return days[idx - 1].id;
        if (days.length > 1) return days[0].id === prev ? days[1].id : days[0].id;
        return null;
      });
      invalidateAll();
      trackRevision("day_removed", "Day removed from trip");
      toast({ title: "Day removed" });
    },
  });

  const moveDayOrder = useMutation({
    mutationFn: async ({ dayId, direction }: { dayId: string; direction: "up" | "down" }) => {
      const idx = days.findIndex(d => d.id === dayId);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= days.length) return;
      await supabase.from("trip_days").update({ day_number: days[swapIdx].day_number }).eq("id", days[idx].id);
      await supabase.from("trip_days").update({ day_number: days[idx].day_number }).eq("id", days[swapIdx].id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-days", id] }),
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
    onSuccess: () => { invalidateAll(); trackRevision("item_added", `Item added from library`); toast({ title: "Item added" }); },
  });

  const addCustomItem = useMutation({
    mutationFn: async () => {
      const maxSort = dayItems.length > 0 ? Math.max(...dayItems.map(i => i.sort_order)) + 1 : 0;
      const qty = parseInt(customForm.quantity) || 1;
      const up = parseFloat(customForm.unit_price) || 0;
      const { error } = await supabase.from("trip_day_items").insert({
        trip_day_id: selectedDayId!,
        custom_title: customForm.custom_title,
        custom_description: customForm.custom_description || null,
        category: customForm.category,
        sort_order: maxSort,
        quantity: qty,
        unit_price: up,
        total_price: up * qty,
        currency: trip?.currency || "USD",
        duration_minutes: customForm.duration_minutes ? parseInt(customForm.duration_minutes) : null,
        start_time: customForm.start_time || null,
        notes: customForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setCustomItemOpen(false);
      setCustomForm(emptyCustomItem);
      toast({ title: "Custom item added" });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("trip_day_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const updateItem = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("trip_day_items").update(updates).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const moveItemOrder = useMutation({
    mutationFn: async ({ itemId, direction }: { itemId: string; direction: "up" | "down" }) => {
      const idx = dayItems.findIndex(i => i.id === itemId);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= dayItems.length) return;
      await supabase.from("trip_day_items").update({ sort_order: dayItems[swapIdx].sort_order }).eq("id", dayItems[idx].id);
      await supabase.from("trip_day_items").update({ sort_order: dayItems[idx].sort_order }).eq("id", dayItems[swapIdx].id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip-day-items", selectedDayId] }),
  });

  const saveEditItem = useMutation({
    mutationFn: async () => {
      if (!editingItemData) return;
      const { error } = await supabase.from("trip_day_items").update({
        custom_title: editingItemData.custom_title,
        custom_description: editingItemData.custom_description,
        category: editingItemData.category,
        start_time: editingItemData.start_time,
        duration_minutes: editingItemData.duration_minutes,
        quantity: editingItemData.quantity,
        unit_price: editingItemData.unit_price,
        total_price: editingItemData.unit_price * editingItemData.quantity,
        notes: editingItemData.notes,
      }).eq("id", editingItemData.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setEditItemOpen(false);
      setEditingItemData(null);
      toast({ title: "Item updated" });
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

  const aiSuggestDay = useCallback(async () => {
    if (!selectedDay || !trip) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("library-ai", {
        body: {
          action: "generate_description",
          data: {
            category: "activity",
            title: `Day ${selectedDay.day_number} itinerary for "${trip.title}"`,
            city: selectedDay.city || "",
            hints: `${trip.adults} adults, ${trip.children} children. Day ${selectedDay.day_number} of ${trip.total_days}. Write a vivid one-paragraph day plan.`,
          },
        },
      });
      if (error) throw error;
      if (data?.result) {
        updateDay.mutate({ dayId: selectedDay.id, updates: { description: data.result } });
        toast({ title: "AI day plan applied" });
      }
    } catch (e: any) {
      toast({ title: "AI Error", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }, [selectedDay, trip, updateDay, toast]);

  const formatDuration = (m: number | null) => {
    if (!m) return null;
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h${r}m` : `${h}h`;
  };

  // === RENDER ===
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

        {/* ===== LEFT: Day Sidebar ===== */}
        <div className="w-64 shrink-0 border-r border-border bg-card/50 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trip Days</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => addDay.mutate()} disabled={addDay.isPending}>
                  {addDay.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add day</TooltipContent>
            </Tooltip>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {days.map((day, dayIdx) => {
                const dayCost = pricingSummary.perDay[day.id] || 0;
                const itemCount = allDayItems.filter(i => i.trip_day_id === day.id).length;
                const isSelected = selectedDayId === day.id;
                return (
                  <motion.div key={day.id} layout>
                    <button
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
                            "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0",
                            isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-accent/10 text-accent"
                          )}>
                            {day.day_number}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate max-w-[100px]">{day.title || `Day ${day.day_number}`}</div>
                            {day.city && (
                              <div className={cn("text-[10px] flex items-center gap-0.5 truncate", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                <MapPin className="w-2.5 h-2.5 shrink-0" /> {day.city}
                              </div>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <div className={cn("opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded cursor-pointer", isSelected ? "hover:bg-primary-foreground/20" : "hover:bg-muted-foreground/10")}>
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {dayIdx > 0 && (
                              <DropdownMenuItem className="text-xs" onClick={e => { e.stopPropagation(); moveDayOrder.mutate({ dayId: day.id, direction: "up" }); }}>
                                <MoveUp className="w-3 h-3 mr-1.5" /> Move up
                              </DropdownMenuItem>
                            )}
                            {dayIdx < days.length - 1 && (
                              <DropdownMenuItem className="text-xs" onClick={e => { e.stopPropagation(); moveDayOrder.mutate({ dayId: day.id, direction: "down" }); }}>
                                <MoveDown className="w-3 h-3 mr-1.5" /> Move down
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-xs" onClick={e => { e.stopPropagation(); duplicateDay.mutate(day.id); }}>
                              <CopyPlus className="w-3 h-3 mr-1.5" /> Duplicate day
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive text-xs" onClick={e => { e.stopPropagation(); removeDay.mutate(day.id); }}>
                              <Trash2 className="w-3 h-3 mr-1.5" /> Remove day
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className={cn("flex items-center gap-3 mt-1.5 text-[10px]", isSelected ? "text-primary-foreground/60" : "text-muted-foreground")}>
                        <span>{itemCount} items</span>
                        {dayCost > 0 && <span className="font-medium">{dayCost.toLocaleString()} {trip.currency}</span>}
                      </div>
                    </button>
                  </motion.div>
                );
              })}
              {/* Add day button at bottom */}
              <button
                onClick={() => addDay.mutate()}
                className="w-full border-2 border-dashed border-border rounded-lg p-3 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3 h-3" /> Add Day
              </button>
            </div>
          </ScrollArea>
        </div>

        {/* ===== CENTER: Day Content ===== */}
        <div className="flex-1 overflow-y-auto">
          {selectedDay ? (
            <div className="p-6 space-y-5 max-w-3xl mx-auto">
              {/* Day Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl gold-gradient flex items-center justify-center text-accent-foreground font-bold text-lg shadow-md">
                    {selectedDay.day_number}
                  </div>
                  <div>
                    <Input
                      value={selectedDay.title || ""}
                      onChange={e => updateDay.mutate({ dayId: selectedDay.id, updates: { title: e.target.value } })}
                      className="border-0 bg-transparent p-0 h-auto text-xl font-bold font-display focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder={`Day ${selectedDay.day_number}`}
                    />
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <Input
                          value={selectedDay.city || ""}
                          onChange={e => updateDay.mutate({ dayId: selectedDay.id, updates: { city: e.target.value } })}
                          className="border-0 bg-transparent p-0 h-auto text-xs text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 w-28"
                          placeholder="City"
                        />
                      </div>
                      {selectedDay.date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {format(new Date(selectedDay.date), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={aiSuggestDay} disabled={aiLoading} className="text-xs gap-1.5 h-8">
                        {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        AI Plan
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate a day plan with AI</TooltipContent>
                  </Tooltip>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="gold-gradient text-accent-foreground text-xs gap-1.5 h-8">
                        <Plus className="w-3 h-3" /> Add
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAddItemOpen(true)}>
                        <Sparkles className="w-3.5 h-3.5 mr-2" /> From Library
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setCustomForm(emptyCustomItem); setCustomItemOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Custom Item
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Day description / notes */}
              <div className="space-y-2">
                <Textarea
                  value={selectedDay.description || ""}
                  onChange={e => updateDay.mutate({ dayId: selectedDay.id, updates: { description: e.target.value } })}
                  placeholder="Day description or notes — visible to the client in the shared itinerary..."
                  rows={2}
                  className="text-sm bg-muted/30 border-border/50 resize-none"
                />
              </div>

              {/* Day items grouped by category */}
              {dayItems.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-2 border-dashed border-border rounded-xl p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Build this day's itinerary</h3>
                  <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                    Add hotels, attractions, activities, transfers, meals and more from your product library or create custom entries
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAddItemOpen(true)}>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> From Library
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setCustomForm(emptyCustomItem); setCustomItemOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Custom Item
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {/* Render categories that have items */}
                  {CATEGORY_META.filter(cm => groupedItems[cm.value]?.length > 0).map(cm => {
                    const items = groupedItems[cm.value];
                    const Icon = cm.icon;
                    return (
                      <div key={cm.value}>
                        {/* Category header */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("w-6 h-6 rounded flex items-center justify-center text-xs", cm.color.split(" ").slice(0, 2).join(" "))}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cm.label}s</span>
                          <span className="text-[10px] text-muted-foreground">({items.length})</span>
                        </div>
                        <div className="space-y-2 pl-2 border-l-2 ml-3" style={{ borderColor: `hsl(var(--border))` }}>
                          <AnimatePresence mode="popLayout">
                            {items.map((item, idx) => (
                              <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ delay: idx * 0.03 }}
                              >
                                <Card className="border-border group hover:shadow-md transition-all">
                                  <CardContent className="p-3">
                                    <div className="flex items-start gap-3">
                                      {/* Time indicator */}
                                      <div className="flex flex-col items-center gap-0.5 pt-0.5 w-12 shrink-0">
                                        {item.start_time ? (
                                          <span className="text-xs font-mono font-medium text-foreground">{item.start_time}</span>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground">—</span>
                                        )}
                                        {item.duration_minutes && (
                                          <span className="text-[10px] text-muted-foreground">{formatDuration(item.duration_minutes)}</span>
                                        )}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <h4 className="text-sm font-semibold text-foreground truncate">{item.custom_title}</h4>
                                            {item.custom_description && (
                                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.custom_description}</p>
                                            )}
                                            {item.notes && (
                                              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 italic">
                                                <StickyNote className="w-2.5 h-2.5" /> {item.notes}
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            {idx > 0 && (
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItemOrder.mutate({ itemId: item.id, direction: "up" })}>
                                                <ChevronUp className="w-3 h-3" />
                                              </Button>
                                            )}
                                            {idx < items.length - 1 && (
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItemOrder.mutate({ itemId: item.id, direction: "down" })}>
                                                <ChevronDown className="w-3 h-3" />
                                              </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingItemData(item); setEditItemOpen(true); }}>
                                              <Pencil className="w-3 h-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem.mutate(item.id)}>
                                              <Trash2 className="w-3 h-3 text-destructive" />
                                            </Button>
                                          </div>
                                        </div>
                                        {/* Price row */}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                          <span>Qty: {item.quantity}</span>
                                          <span className="font-medium text-foreground">{item.unit_price.toLocaleString()} × {item.quantity} = {item.total_price.toLocaleString()} {item.currency}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}

                  {/* Quick add bar */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setAddItemOpen(true)}>
                      <Plus className="w-3 h-3 mr-1" /> Library
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { setCustomForm(emptyCustomItem); setCustomItemOpen(true); }}>
                      <Pencil className="w-3 h-3 mr-1" /> Custom
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a day to start building</p>
              </div>
            </div>
          )}
        </div>

        {/* ===== RIGHT: Pricing Panel ===== */}
        <div className="w-80 shrink-0 border-l border-border bg-card/50 flex flex-col">
          {/* Pricing View Toggle */}
          <div className="p-3 border-b border-border">
            <Tabs value={pricingView} onValueChange={v => setPricingView(v as "internal" | "client" | "feedback")}>
              <TabsList className="w-full h-8">
                <TabsTrigger value="internal" className="flex-1 text-[11px] gap-1">
                  <EyeOff className="w-3 h-3" /> Internal
                </TabsTrigger>
                <TabsTrigger value="client" className="flex-1 text-[11px] gap-1">
                  <Eye className="w-3 h-3" /> Client
                </TabsTrigger>
                <TabsTrigger value="feedback" className="flex-1 text-[11px] gap-1 relative">
                  <MessageCircle className="w-3 h-3" /> Feedback
                  {tripFeedback.length > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-accent text-accent-foreground text-[9px] font-bold flex items-center justify-center">
                      {tripFeedback.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            {pricingView === "internal" ? (
              /* ===== INTERNAL PRICING VIEW ===== */
              <div className="p-4 space-y-4">
                {/* Cost Summary */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Receipt className="w-3 h-3" /> Cost Breakdown
                  </h3>
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Base Cost</span>
                      <span className="text-sm font-semibold text-foreground font-mono">{pricingSummary.totalCost.toLocaleString()} {trip.currency}</span>
                    </div>
                    {pricingSummary.markupAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Markup
                        </span>
                        <span className="text-xs font-medium text-foreground font-mono">+{pricingSummary.markupAmount.toLocaleString()}</span>
                      </div>
                    )}
                    {pricingSummary.discountAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Discount
                        </span>
                        <span className="text-xs font-medium text-destructive font-mono">-{pricingSummary.discountAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Markup Controls */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Percent className="w-3 h-3" /> Markup
                  </Label>
                  <div className="flex gap-2">
                    <Select 
                      value={(trip as any)?.markup_type || "percentage"} 
                      onValueChange={v => updateTrip.mutate({ markup_type: v })}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">%</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(trip as any)?.markup_value || ""}
                      onChange={e => updateTrip.mutate({ markup_value: parseFloat(e.target.value) || 0 })}
                      className="flex-1 h-8 text-xs text-right font-mono"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Discount Controls */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> Discount
                  </Label>
                  <div className="flex gap-2">
                    <Select 
                      value={(trip as any)?.discount_type || "fixed"} 
                      onValueChange={v => updateTrip.mutate({ discount_type: v })}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="percentage">%</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={(trip as any)?.discount_value || ""}
                      onChange={e => updateTrip.mutate({ discount_value: parseFloat(e.target.value) || 0 })}
                      className="flex-1 h-8 text-xs text-right font-mono"
                      placeholder="0"
                    />
                  </div>
                </div>

                <Separator />

                {/* Selling Price */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Selling Price</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[10px] text-accent"
                      onClick={() => updateTrip.mutate({ selling_price: Math.round(pricingSummary.calculatedClientPrice * 100) / 100 })}
                    >
                      Auto-fill from calc
                    </Button>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={trip.selling_price || ""}
                    onChange={e => updateTrip.mutate({ selling_price: parseFloat(e.target.value) || 0 })}
                    className="text-right font-bold text-base font-mono h-10"
                  />
                  <div className="text-[10px] text-muted-foreground text-right">
                    Calculated: {pricingSummary.calculatedClientPrice.toLocaleString()} {trip.currency}
                  </div>
                </div>

                {/* Profit & Margin */}
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-medium">Profit</span>
                    <span className={cn("text-sm font-bold font-mono", pricingSummary.profit >= 0 ? "text-emerald-600" : "text-destructive")}>
                      {pricingSummary.profit >= 0 ? "+" : ""}{pricingSummary.profit.toLocaleString()} {trip.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-medium">Margin</span>
                    <Badge variant="outline" className={cn("text-xs font-mono", pricingSummary.margin >= 20 ? "text-emerald-600 border-emerald-200" : pricingSummary.margin >= 0 ? "text-amber-600 border-amber-200" : "text-destructive border-destructive/30")}>
                      <TrendingUp className="w-3 h-3 mr-1" /> {pricingSummary.margin.toFixed(1)}%
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Per Day Breakdown with item-level details */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Per Day Breakdown</h3>
                  {days.map(day => {
                    const cost = pricingSummary.perDay[day.id] || 0;
                    const items = pricingSummary.perDayItems[day.id] || [];
                    const isSelected = selectedDayId === day.id;
                    return (
                      <div key={day.id} className="space-y-1">
                        <div
                          onClick={() => setSelectedDayId(day.id)}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors",
                            isSelected ? "bg-accent/10 border border-accent/20" : "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded text-[10px] flex items-center justify-center bg-accent/10 text-accent font-bold">{day.day_number}</span>
                            <div>
                              <span className="font-medium text-foreground">{day.title || `Day ${day.day_number}`}</span>
                              {day.city && <span className="text-[10px] text-muted-foreground ml-1">· {day.city}</span>}
                            </div>
                          </div>
                          <span className="font-semibold text-foreground font-mono">{cost > 0 ? `${cost.toLocaleString()}` : "—"}</span>
                        </div>
                        {/* Item-level prices under selected day */}
                        {isSelected && items.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="ml-7 space-y-0.5 pb-1"
                          >
                            {items.map(item => (
                              <div key={item.id} className="flex items-center justify-between text-[10px] text-muted-foreground px-2 py-1 rounded hover:bg-muted/30">
                                <span className="truncate max-w-[120px]">{item.custom_title}</span>
                                <span className="font-mono shrink-0 ml-2">{(item.total_price || 0).toLocaleString()}</span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Separator />

                {/* Internal Pricing Notes */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <StickyNote className="w-3 h-3" /> Pricing Notes (Internal)
                  </Label>
                  <Textarea
                    value={(trip as any)?.pricing_notes || ""}
                    onChange={e => updateTrip.mutate({ pricing_notes: e.target.value })}
                    placeholder="Internal pricing notes — supplier rates, negotiations, cost justification..."
                    rows={3}
                    className="text-xs"
                  />
                </div>

                {/* Trip Internal Notes */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Internal Notes</Label>
                  <Textarea
                    value={trip.internal_notes || ""}
                    onChange={e => updateTrip.mutate({ internal_notes: e.target.value })}
                    placeholder="Trip notes..."
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>
            ) : pricingView === "client" ? (
              /* ===== CLIENT-FACING PRICING VIEW ===== */
              <div className="p-4 space-y-4">
                <div className="text-center py-3">
                  <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center mx-auto mb-2">
                    <Eye className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold font-display text-foreground">Client View</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Preview what the client sees</p>
                </div>

                <Separator />

                {/* Client trip summary */}
                <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                  <div className="text-center">
                    <h4 className="text-sm font-bold font-display text-foreground">{trip.title}</h4>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {trip.total_days} days · {trip.adults} adults{trip.children > 0 ? ` · ${trip.children} children` : ""}
                    </p>
                  </div>

                  <Separator />

                  {/* Per-day totals (client sees clean totals, no cost breakdown) */}
                  <div className="space-y-1.5">
                    {days.map(day => {
                      const cost = pricingSummary.perDay[day.id] || 0;
                      const items = pricingSummary.perDayItems[day.id] || [];
                      return (
                        <div key={day.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md gold-gradient text-[10px] flex items-center justify-center text-accent-foreground font-bold">{day.day_number}</span>
                              <span className="font-medium">{day.title || `Day ${day.day_number}`}</span>
                            </div>
                          </div>
                          <div className="ml-7 space-y-0.5">
                            {items.map(item => (
                              <div key={item.id} className="text-[10px] text-muted-foreground px-2 py-0.5 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                                <span className="truncate">{item.custom_title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator />

                  {/* Client total price */}
                  <div className="text-center py-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Price</span>
                    <div className="text-2xl font-bold font-display text-foreground mt-1">
                      {(trip.selling_price || 0).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{trip.currency}</span>
                    </div>
                    {trip.adults > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {Math.round((trip.selling_price || 0) / (trip.adults + trip.children)).toLocaleString()} {trip.currency} per person
                      </div>
                    )}
                  </div>
                </div>

                {/* Client Notes */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" /> Client Notes
                  </Label>
                  <Textarea
                    value={(trip as any)?.client_notes || ""}
                    onChange={e => updateTrip.mutate({ client_notes: e.target.value })}
                    placeholder="Notes visible to the client — inclusions, terms, payment info..."
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>
            ) : (
              /* ===== FEEDBACK VIEW ===== */
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client Feedback</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {tripFeedback.length} {tripFeedback.length === 1 ? "response" : "responses"}
                  </Badge>
                </div>

                {tripFeedback.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No feedback yet</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Share the trip link with your client to get feedback</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tripFeedback.map(fb => {
                      const isApproval = fb.feedback_type === "approval";
                      const isChange = fb.feedback_type === "change_request";
                      return (
                        <div key={fb.id} className={cn(
                          "rounded-lg border p-3 space-y-2",
                          isApproval ? "border-emerald-200 bg-emerald-50/30" :
                          isChange ? "border-amber-200 bg-amber-50/30" :
                          "border-border bg-background"
                        )}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-6 h-6 rounded flex items-center justify-center",
                                isApproval ? "bg-emerald-100" : isChange ? "bg-amber-100" : "bg-blue-100"
                              )}>
                                {isApproval ? <CheckCircle className="w-3 h-3 text-emerald-600" /> :
                                 isChange ? <RefreshCw className="w-3 h-3 text-amber-600" /> :
                                 <MessageCircle className="w-3 h-3 text-blue-600" />}
                              </div>
                              <span className="text-xs font-semibold text-foreground">{fb.client_name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {format(new Date(fb.created_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(
                              "text-[9px]",
                              isApproval ? "text-emerald-600 border-emerald-200" :
                              isChange ? "text-amber-600 border-amber-200" :
                              "text-blue-600 border-blue-200"
                            )}>
                              {isApproval ? "Approved" : isChange ? "Change Request" : "Comment"}
                            </Badge>
                            {fb.client_email && (
                              <span className="text-[10px] text-muted-foreground truncate">{fb.client_email}</span>
                            )}
                          </div>
                          {fb.message && (
                            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{fb.message}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* ===== DIALOG: Add from Library ===== */}
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
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORY_META.map(c => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="flex items-center gap-1.5"><c.icon className="w-3 h-3" /> {c.label}s</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="space-y-1.5">
              {filteredLibrary.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No items found. Add items in the Product Library first.</p>
              ) : (
                filteredLibrary.map(item => {
                  const meta = getCatMeta(item.category);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 hover:border-foreground/10 cursor-pointer transition-all group"
                      onClick={() => { addItemFromLibrary.mutate(item); setAddItemOpen(false); }}
                    >
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", meta.color.split(" ").slice(0, 2).join(" "))}>
                        <meta.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground truncate">{item.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span className="capitalize">{item.category}</span>
                          {item.city && <span className="flex items-center gap-0.5">· <MapPin className="w-2.5 h-2.5" />{item.city}</span>}
                          {item.duration_minutes && <span>· {formatDuration(item.duration_minutes)}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {item.price_amount != null && item.price_amount > 0 && (
                          <span className="text-sm font-semibold text-foreground">{item.price_amount} {item.price_currency}</span>
                        )}
                      </div>
                      <Plus className="w-4 h-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: Custom Item ===== */}
      <Dialog open={customItemOpen} onOpenChange={setCustomItemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Pencil className="w-5 h-5 text-accent" /> Add Custom Item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={customForm.category} onValueChange={v => setCustomForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_META.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-1.5"><c.icon className="w-3 h-3" /> {c.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Title</Label>
                <Input value={customForm.custom_title} onChange={e => setCustomForm(f => ({ ...f, custom_title: e.target.value }))} placeholder="e.g. Private Desert Safari" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea value={customForm.custom_description} onChange={e => setCustomForm(f => ({ ...f, custom_description: e.target.value }))} placeholder="Service description..." rows={2} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Start Time</Label>
                <Input type="time" value={customForm.start_time} onChange={e => setCustomForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Duration (min)</Label>
                <Input type="number" min="0" value={customForm.duration_minutes} onChange={e => setCustomForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="120" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Unit Price</Label>
                <Input type="number" min="0" step="0.01" value={customForm.unit_price} onChange={e => setCustomForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Quantity</Label>
                <Input type="number" min="1" value={customForm.quantity} onChange={e => setCustomForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Internal Notes</Label>
              <Textarea value={customForm.notes} onChange={e => setCustomForm(f => ({ ...f, notes: e.target.value }))} placeholder="Operational notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomItemOpen(false)}>Cancel</Button>
            <Button onClick={() => addCustomItem.mutate()} disabled={!customForm.custom_title || addCustomItem.isPending} className="gold-gradient text-accent-foreground">
              {addCustomItem.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: Edit Item ===== */}
      <Dialog open={editItemOpen} onOpenChange={v => { setEditItemOpen(v); if (!v) setEditingItemData(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Pencil className="w-5 h-5 text-accent" /> Edit Item
            </DialogTitle>
          </DialogHeader>
          {editingItemData && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-1.5">
                  <Label className="text-xs font-medium">Category</Label>
                  <Select value={editingItemData.category} onValueChange={v => setEditingItemData(d => d ? { ...d, category: v } : d)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_META.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-1.5"><c.icon className="w-3 h-3" /> {c.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium">Title</Label>
                  <Input value={editingItemData.custom_title || ""} onChange={e => setEditingItemData(d => d ? { ...d, custom_title: e.target.value } : d)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Description</Label>
                <Textarea value={editingItemData.custom_description || ""} onChange={e => setEditingItemData(d => d ? { ...d, custom_description: e.target.value } : d)} rows={2} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Start Time</Label>
                  <Input type="time" value={editingItemData.start_time || ""} onChange={e => setEditingItemData(d => d ? { ...d, start_time: e.target.value } : d)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Duration</Label>
                  <Input type="number" min="0" value={editingItemData.duration_minutes || ""} onChange={e => setEditingItemData(d => d ? { ...d, duration_minutes: parseInt(e.target.value) || null } : d)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Unit Price</Label>
                  <Input type="number" min="0" step="0.01" value={editingItemData.unit_price} onChange={e => setEditingItemData(d => d ? { ...d, unit_price: parseFloat(e.target.value) || 0 } : d)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Quantity</Label>
                  <Input type="number" min="1" value={editingItemData.quantity} onChange={e => setEditingItemData(d => d ? { ...d, quantity: parseInt(e.target.value) || 1 } : d)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Textarea value={editingItemData.notes || ""} onChange={e => setEditingItemData(d => d ? { ...d, notes: e.target.value } : d)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItemOpen(false)}>Cancel</Button>
            <Button onClick={() => saveEditItem.mutate()} disabled={saveEditItem.isPending} className="gold-gradient text-accent-foreground">
              {saveEditItem.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
