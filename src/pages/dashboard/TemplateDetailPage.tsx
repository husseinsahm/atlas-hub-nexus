import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { runMutationWithRetry, getMutationErrorMessage } from "@/lib/supabaseMutation";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, Edit,
  GripVertical, Loader2, Save, MapPin, Calendar, Image as ImageIcon,
  CheckCircle2, XCircle, Clock, Upload, X, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ─── Types ───
interface TemplateDayItem {
  id: string;
  template_day_id: string;
  category: string;
  custom_title: string | null;
  custom_description: string | null;
  sort_order: number;
  duration_minutes: number | null;
}

interface TemplateDay {
  id: string;
  template_id: string;
  day_number: number;
  title: string | null;
  description: string | null;
  city: string | null;
  items: TemplateDayItem[];
}

interface TemplateOption {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  duration_nights: number;
  departure_from: string | null;
  sort_order: number;
}

interface TemplateInclusion {
  id: string;
  template_id: string;
  type: string;
  content: string;
  sort_order: number;
}

interface GalleryImage {
  id: string;
  template_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

interface Availability {
  id: string;
  template_id: string;
  day_of_week: string;
  departure_from: string;
  notes: string | null;
  sort_order: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  activity: "🏛️",
  transport: "🚌",
  hotel: "🏨",
  meal: "🍽️",
  flight: "✈️",
  cruise: "🚢",
  other: "📌",
};

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isArabic = language === "ar";
  const companyId = user?.activeMembership?.companyId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("itinerary");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ dayId: string; item?: TemplateDayItem } | null>(null);
  const [editingDay, setEditingDay] = useState<TemplateDay | null>(null);
  const [itemForm, setItemForm] = useState({ title: "", description: "", category: "activity" });
  const [dayForm, setDayForm] = useState({ title: "", description: "", city: "" });

  // Option dialog
  const [editingOption, setEditingOption] = useState<TemplateOption | null | "new">(null);
  const [optionForm, setOptionForm] = useState({ title: "", description: "", duration_nights: 3, departure_from: "" });

  // Inclusion dialog
  const [editingInclusion, setEditingInclusion] = useState<{ type: string; item?: TemplateInclusion } | null>(null);
  const [inclusionForm, setInclusionForm] = useState("");

  // Availability dialog
  const [editingAvail, setEditingAvail] = useState<Availability | null | "new">(null);
  const [availForm, setAvailForm] = useState({ day_of_week: "Monday", departure_from: "", notes: "" });

  // Gallery upload
  const [isUploading, setIsUploading] = useState(false);

  // ─── Queries ───
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ["template", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("itinerary_templates").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: days = [] } = useQuery({
    queryKey: ["template-days", id],
    queryFn: async () => {
      const { data: daysData, error } = await supabase
        .from("template_days").select("*").eq("template_id", id!).order("day_number", { ascending: true });
      if (error) throw error;
      const dayIds = daysData.map((d: any) => d.id);
      let items: TemplateDayItem[] = [];
      if (dayIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("template_day_items").select("*").in("template_day_id", dayIds).order("sort_order", { ascending: true });
        if (itemsData) items = itemsData as TemplateDayItem[];
      }
      return daysData.map((day: any) => ({ ...day, items: items.filter((i) => i.template_day_id === day.id) })) as TemplateDay[];
    },
    enabled: !!id,
  });

  const { data: options = [] } = useQuery({
    queryKey: ["template-options", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("template_options").select("*").eq("template_id", id!).order("sort_order");
      if (error) throw error;
      return data as TemplateOption[];
    },
    enabled: !!id,
  });

  const { data: inclusions = [] } = useQuery({
    queryKey: ["template-inclusions", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("template_inclusions").select("*").eq("template_id", id!).order("sort_order");
      if (error) throw error;
      return data as TemplateInclusion[];
    },
    enabled: !!id,
  });

  const { data: gallery = [] } = useQuery({
    queryKey: ["template-gallery", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("template_gallery").select("*").eq("template_id", id!).order("sort_order");
      if (error) throw error;
      return data as GalleryImage[];
    },
    enabled: !!id,
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["template-availability", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("template_availability").select("*").eq("template_id", id!).order("sort_order");
      if (error) throw error;
      return data as Availability[];
    },
    enabled: !!id,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["template-days", id] });
    queryClient.invalidateQueries({ queryKey: ["template-options", id] });
    queryClient.invalidateQueries({ queryKey: ["template-inclusions", id] });
    queryClient.invalidateQueries({ queryKey: ["template-gallery", id] });
    queryClient.invalidateQueries({ queryKey: ["template-availability", id] });
  };

  // ─── Day/Item Mutations (same as before) ───
  const toggleDay = (dayId: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(dayId) ? next.delete(dayId) : next.add(dayId);
      return next;
    });
  };

  const saveItemMutation = useMutation({
    mutationFn: async ({ dayId, item }: { dayId: string; item?: TemplateDayItem }) => {
      const payload = {
        template_day_id: dayId,
        custom_title: itemForm.title.trim(),
        custom_description: itemForm.description.trim() || null,
        category: itemForm.category,
        sort_order: item ? item.sort_order : (days.find((d) => d.id === dayId)?.items.length ?? 0),
      };
      if (item) {
        return runMutationWithRetry(
          { table: "template_day_items", operation: "update", payload, userId: user?.id, companyId, fallback: { filters: [{ column: "id", value: item.id }], select: "*", single: true } },
          async () => { const r = await supabase.from("template_day_items").update(payload).eq("id", item.id).select("*").single(); return { data: r.data, error: r.error, status: r.status, statusText: r.statusText }; }
        );
      }
      return runMutationWithRetry(
        { table: "template_day_items", operation: "insert", payload, userId: user?.id, companyId, fallback: { select: "*", single: true } },
        async () => { const r = await supabase.from("template_day_items").insert(payload).select("*").single(); return { data: r.data, error: r.error, status: r.status, statusText: r.statusText }; }
      );
    },
    onSuccess: () => { invalidateAll(); setEditingItem(null); setItemForm({ title: "", description: "", category: "activity" }); toast({ title: isArabic ? "تم الحفظ" : "Item saved" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return runMutationWithRetry(
        { table: "template_day_items", operation: "delete", userId: user?.id, companyId, fallback: { filters: [{ column: "id", value: itemId }] } },
        async () => { const r = await supabase.from("template_day_items").delete().eq("id", itemId).select("*"); return { data: r.data, error: r.error, status: r.status, statusText: r.statusText }; }
      );
    },
    onSuccess: () => { invalidateAll(); toast({ title: isArabic ? "تم الحذف" : "Item deleted" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  const addDayMutation = useMutation({
    mutationFn: async () => {
      const nextNumber = days.length > 0 ? Math.max(...days.map((d) => d.day_number)) + 1 : 1;
      const payload = { template_id: id!, day_number: nextNumber, title: `Day ${nextNumber}` };
      return runMutationWithRetry(
        { table: "template_days", operation: "insert", payload, userId: user?.id, companyId, fallback: { select: "*", single: true } },
        async () => { const r = await supabase.from("template_days").insert(payload).select("*").single(); return { data: r.data, error: r.error, status: r.status, statusText: r.statusText }; }
      );
    },
    onSuccess: () => { invalidateAll(); toast({ title: isArabic ? "تمت إضافة يوم" : "Day added" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  const updateDayMutation = useMutation({
    mutationFn: async (day: TemplateDay) => {
      const payload = { title: dayForm.title.trim() || null, description: dayForm.description.trim() || null, city: dayForm.city.trim() || null };
      return runMutationWithRetry(
        { table: "template_days", operation: "update", payload, userId: user?.id, companyId, fallback: { filters: [{ column: "id", value: day.id }], select: "*", single: true } },
        async () => { const r = await supabase.from("template_days").update(payload).eq("id", day.id).select("*").single(); return { data: r.data, error: r.error, status: r.status, statusText: r.statusText }; }
      );
    },
    onSuccess: () => { invalidateAll(); setEditingDay(null); toast({ title: isArabic ? "تم تحديث اليوم" : "Day updated" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  const deleteDayMutation = useMutation({
    mutationFn: async (dayId: string) => {
      await supabase.from("template_day_items").delete().eq("template_day_id", dayId);
      return runMutationWithRetry(
        { table: "template_days", operation: "delete", userId: user?.id, companyId, fallback: { filters: [{ column: "id", value: dayId }] } },
        async () => { const r = await supabase.from("template_days").delete().eq("id", dayId).select("*"); return { data: r.data, error: r.error, status: r.status, statusText: r.statusText }; }
      );
    },
    onSuccess: () => { invalidateAll(); toast({ title: isArabic ? "تم حذف اليوم" : "Day deleted" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  // ─── Options Mutations ───
  const saveOptionMutation = useMutation({
    mutationFn: async (existing?: TemplateOption) => {
      const payload = {
        template_id: id!,
        title: optionForm.title.trim(),
        description: optionForm.description.trim() || null,
        duration_nights: optionForm.duration_nights,
        departure_from: optionForm.departure_from.trim() || null,
        sort_order: existing ? existing.sort_order : options.length,
      };
      if (existing) {
        return runMutationWithRetry(
          { table: "template_options", operation: "update", payload, userId: user?.id, companyId, fallback: { filters: [{ column: "id", value: existing.id }], select: "*", single: true } },
          async () => { const r = await supabase.from("template_options").update(payload).eq("id", existing.id).select("*").single(); return { data: r.data, error: r.error, status: r.status, statusText: r.statusText }; }
        );
      }
      return runMutationWithRetry(
        { table: "template_options", operation: "insert", payload, userId: user?.id, companyId, fallback: { select: "*", single: true } },
        async () => { const r = await supabase.from("template_options").insert(payload).select("*").single(); return { data: r.data, error: r.error, status: r.status, statusText: r.statusText }; }
      );
    },
    onSuccess: () => { invalidateAll(); setEditingOption(null); toast({ title: isArabic ? "تم الحفظ" : "Option saved" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (optionId: string) => {
      const r = await supabase.from("template_options").delete().eq("id", optionId).select("*");
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => { invalidateAll(); toast({ title: isArabic ? "تم الحذف" : "Option deleted" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  // ─── Inclusions Mutations ───
  const saveInclusionMutation = useMutation({
    mutationFn: async ({ type, item }: { type: string; item?: TemplateInclusion }) => {
      const payload = {
        template_id: id!,
        type,
        content: inclusionForm.trim(),
        sort_order: item ? item.sort_order : inclusions.filter(i => i.type === type).length,
      };
      if (item) {
        const r = await supabase.from("template_inclusions").update(payload).eq("id", item.id).select("*").single();
        if (r.error) throw r.error;
        return r.data;
      }
      const r = await supabase.from("template_inclusions").insert(payload).select("*").single();
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => { invalidateAll(); setEditingInclusion(null); setInclusionForm(""); toast({ title: isArabic ? "تم الحفظ" : "Saved" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  const deleteInclusionMutation = useMutation({
    mutationFn: async (incId: string) => {
      const r = await supabase.from("template_inclusions").delete().eq("id", incId).select("*");
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => { invalidateAll(); toast({ title: isArabic ? "تم الحذف" : "Deleted" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  // ─── Gallery Mutations ───
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !companyId) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop();
        const path = `${companyId}/templates/${id}/${Date.now()}_${i}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("company-assets").upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path);
        await supabase.from("template_gallery").insert({
          template_id: id!,
          image_url: urlData.publicUrl,
          caption: file.name.replace(/\.[^/.]+$/, ""),
          sort_order: gallery.length + i,
        });
      }
      invalidateAll();
      toast({ title: isArabic ? "تم رفع الصور" : "Images uploaded" });
    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteGalleryMutation = useMutation({
    mutationFn: async (imgId: string) => {
      const r = await supabase.from("template_gallery").delete().eq("id", imgId).select("*");
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => { invalidateAll(); toast({ title: isArabic ? "تم الحذف" : "Image deleted" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  // ─── Availability Mutations ───
  const saveAvailMutation = useMutation({
    mutationFn: async (existing?: Availability) => {
      const payload = {
        template_id: id!,
        day_of_week: availForm.day_of_week,
        departure_from: availForm.departure_from.trim(),
        notes: availForm.notes.trim() || null,
        sort_order: existing ? existing.sort_order : availability.length,
      };
      if (existing) {
        const r = await supabase.from("template_availability").update(payload).eq("id", existing.id).select("*").single();
        if (r.error) throw r.error;
        return r.data;
      }
      const r = await supabase.from("template_availability").insert(payload).select("*").single();
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => { invalidateAll(); setEditingAvail(null); toast({ title: isArabic ? "تم الحفظ" : "Saved" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  const deleteAvailMutation = useMutation({
    mutationFn: async (avId: string) => {
      const r = await supabase.from("template_availability").delete().eq("id", avId).select("*");
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => { invalidateAll(); toast({ title: isArabic ? "تم الحذف" : "Deleted" }); },
    onError: (err) => { toast({ title: getMutationErrorMessage(err), variant: "destructive" }); },
  });

  // ─── Helpers ───
  const openItemDialog = (dayId: string, item?: TemplateDayItem) => {
    setEditingItem({ dayId, item });
    setItemForm({ title: item?.custom_title || "", description: item?.custom_description || "", category: item?.category || "activity" });
  };

  const openDayDialog = (day: TemplateDay) => {
    setEditingDay(day);
    setDayForm({ title: day.title || "", description: day.description || "", city: day.city || "" });
  };

  const openOptionDialog = (opt?: TemplateOption) => {
    setEditingOption(opt || "new");
    setOptionForm({
      title: opt?.title || "",
      description: opt?.description || "",
      duration_nights: opt?.duration_nights || 3,
      departure_from: opt?.departure_from || "",
    });
  };

  const openAvailDialog = (av?: Availability) => {
    setEditingAvail(av || "new");
    setAvailForm({
      day_of_week: av?.day_of_week || "Monday",
      departure_from: av?.departure_from || "",
      notes: av?.notes || "",
    });
  };

  if (templateLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!template) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{isArabic ? "القالب غير موجود" : "Template not found"}</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/templates")} className="mt-4"><ArrowLeft className="w-4 h-4 mr-2" />{isArabic ? "رجوع" : "Back"}</Button>
      </div>
    );
  }

  const includes = inclusions.filter(i => i.type === "include");
  const excludes = inclusions.filter(i => i.type === "exclude");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/templates")} className="shrink-0"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold font-display text-foreground truncate">{template.title}</h1>
          {template.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>}
        </div>
        <Badge variant="secondary" className="gap-1"><Calendar className="w-3 h-3" />{template.total_days} {isArabic ? "يوم" : "days"}</Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="itinerary">{isArabic ? "البرنامج" : "Itinerary"}</TabsTrigger>
          <TabsTrigger value="options" className="gap-1"><Layers className="w-3 h-3" />{isArabic ? "الخيارات" : "Options"}{options.length > 0 && <Badge variant="secondary" className="text-[9px] px-1 ml-1">{options.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="inclusions">{isArabic ? "يشمل / لا يشمل" : "Includes"}</TabsTrigger>
          <TabsTrigger value="gallery" className="gap-1"><ImageIcon className="w-3 h-3" />{isArabic ? "المعرض" : "Gallery"}{gallery.length > 0 && <Badge variant="secondary" className="text-[9px] px-1 ml-1">{gallery.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="availability" className="gap-1"><Clock className="w-3 h-3" />{isArabic ? "التوفر" : "Availability"}</TabsTrigger>
        </TabsList>

        {/* ══════════ ITINERARY TAB ══════════ */}
        <TabsContent value="itinerary">
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">{isArabic ? "البرنامج اليومي" : "Daily Itinerary"}</h2>
              <Button size="sm" variant="outline" onClick={() => addDayMutation.mutate()} disabled={addDayMutation.isPending} className="gap-1.5 text-xs">
                {addDayMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {isArabic ? "إضافة يوم" : "Add Day"}
              </Button>
            </div>

            {days.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد أيام بعد" : "No days yet"}</p>
                  <Button size="sm" variant="outline" onClick={() => addDayMutation.mutate()} className="mt-3 gap-1.5"><Plus className="w-3.5 h-3.5" />{isArabic ? "إضافة يوم" : "Add Day"}</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {days.map((day) => {
                  const isExpanded = expandedDays.has(day.id);
                  return (
                    <Card key={day.id} className="border-border overflow-hidden">
                      <button onClick={() => toggleDay(day.id)} className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors bg-primary text-primary-foreground hover:bg-primary/90">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-semibold text-sm">{day.title || `${isArabic ? "اليوم" : "Day"} ${day.day_number}`}</span>
                          {day.city && <Badge variant="secondary" className="text-[10px] bg-primary-foreground/15 text-primary-foreground border-0 gap-1"><MapPin className="w-2.5 h-2.5" />{day.city}</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-primary-foreground/60">{day.items.length} {isArabic ? "عنصر" : "items"}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="p-4 space-y-2">
                              {day.description && <p className="text-xs text-muted-foreground italic mb-3">{day.description}</p>}
                              {day.items.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">{isArabic ? "لا توجد عناصر" : "No items yet"}</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {day.items.map((item) => (
                                    <div key={item.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                                      <span className="text-base shrink-0">{CATEGORY_ICONS[item.category] || "📌"}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground">{item.custom_title || (isArabic ? "بدون عنوان" : "Untitled")}</p>
                                        {item.custom_description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.custom_description}</p>}
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openItemDialog(day.id, item)}><Edit className="w-3.5 h-3.5" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteItemMutation.mutate(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center gap-2 pt-2 border-t border-border mt-3">
                                <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={() => openItemDialog(day.id)}><Plus className="w-3 h-3" />{isArabic ? "إضافة عنصر" : "Add Item"}</Button>
                                <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => openDayDialog(day)}><Edit className="w-3 h-3" />{isArabic ? "تعديل" : "Edit"}</Button>
                                <Button size="sm" variant="ghost" className="text-xs gap-1 text-destructive hover:text-destructive" onClick={() => deleteDayMutation.mutate(day.id)}><Trash2 className="w-3 h-3" />{isArabic ? "حذف" : "Delete"}</Button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════ OPTIONS TAB ══════════ */}
        <TabsContent value="options">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">{isArabic ? "خيارات البرنامج" : "Itinerary Options"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{isArabic ? "مثال: 3 ليالي من أسوان، 4 ليالي من إسنا" : "e.g., 3 Nights from Aswan, 4 Nights from Esna"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openOptionDialog()} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" />{isArabic ? "إضافة خيار" : "Add Option"}</Button>
            </div>

            {options.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-10 text-center">
                <Layers className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد خيارات بعد" : "No options yet"}</p>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {options.map((opt) => (
                  <Card key={opt.id} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">{opt.title}</h3>
                          {opt.description && <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-[10px]">🌙 {opt.duration_nights} {isArabic ? "ليالي" : "Nights"}</Badge>
                            {opt.departure_from && <Badge variant="outline" className="text-[10px] gap-1"><MapPin className="w-2.5 h-2.5" />{isArabic ? "من" : "From"} {opt.departure_from}</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openOptionDialog(opt)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteOptionMutation.mutate(opt.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════ INCLUSIONS TAB ══════════ */}
        <TabsContent value="inclusions">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Includes */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" />{isArabic ? "يشمل" : "Included"}</CardTitle>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setEditingInclusion({ type: "include" }); setInclusionForm(""); }}><Plus className="w-3 h-3" />{isArabic ? "إضافة" : "Add"}</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {includes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{isArabic ? "لا توجد عناصر" : "No items"}</p>
                ) : includes.map((inc) => (
                  <div key={inc.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-sm text-foreground flex-1">{inc.content}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingInclusion({ type: "include", item: inc }); setInclusionForm(inc.content); }}><Edit className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteInclusionMutation.mutate(inc.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Excludes */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" />{isArabic ? "لا يشمل" : "Excluded"}</CardTitle>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setEditingInclusion({ type: "exclude" }); setInclusionForm(""); }}><Plus className="w-3 h-3" />{isArabic ? "إضافة" : "Add"}</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {excludes.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{isArabic ? "لا توجد عناصر" : "No items"}</p>
                ) : excludes.map((exc) => (
                  <div key={exc.id} className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10">
                    <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="text-sm text-foreground flex-1">{exc.content}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingInclusion({ type: "exclude", item: exc }); setInclusionForm(exc.content); }}><Edit className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteInclusionMutation.mutate(exc.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════════ GALLERY TAB ══════════ */}
        <TabsContent value="gallery">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">{isArabic ? "معرض الصور" : "Photo Gallery"}</h2>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="gap-1.5 text-xs">
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {isArabic ? "رفع صور" : "Upload Images"}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
            </div>

            {gallery.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-12 text-center">
                <ImageIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد صور بعد" : "No images yet"}</p>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-3 gap-1.5"><Upload className="w-3.5 h-3.5" />{isArabic ? "رفع صور" : "Upload"}</Button>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {gallery.map((img) => (
                  <div key={img.id} className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-border bg-muted">
                    <img src={img.image_url} alt={img.caption || ""} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => deleteGalleryMutation.mutate(img.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {img.caption && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-[10px] text-white truncate">{img.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══════════ AVAILABILITY TAB ══════════ */}
        <TabsContent value="availability">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">{isArabic ? "مواعيد التوفر" : "Availability Schedule"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{isArabic ? "مثال: الإثنين من إسنا، الجمعة من أسوان" : "e.g., Monday from Esna, Friday from Aswan"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => openAvailDialog()} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" />{isArabic ? "إضافة" : "Add Schedule"}</Button>
            </div>

            {availability.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-10 text-center">
                <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد مواعيد بعد" : "No availability set"}</p>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {availability.map((av) => (
                  <Card key={av.id} className="group hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">{av.day_of_week}</h3>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{isArabic ? "من" : "From"} {av.departure_from}</p>
                          {av.notes && <p className="text-xs text-muted-foreground mt-1 italic">{av.notes}</p>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAvailDialog(av)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAvailMutation.mutate(av.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════ DIALOGS ══════════ */}

      {/* Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem?.item ? (isArabic ? "تعديل عنصر" : "Edit Item") : (isArabic ? "إضافة عنصر" : "Add Item")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-xs">{isArabic ? "العنوان" : "Title"} *</Label><Input value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} placeholder={isArabic ? "مثال: زيارة المعبد" : "e.g., Visit Philae Temple"} className="mt-1" /></div>
            <div><Label className="text-xs">{isArabic ? "الوصف" : "Description"}</Label><Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} rows={2} className="mt-1 text-xs" /></div>
            <div>
              <Label className="text-xs">{isArabic ? "التصنيف" : "Category"}</Label>
              <select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="activity">{isArabic ? "نشاط" : "🏛️ Activity"}</option>
                <option value="transport">{isArabic ? "نقل" : "🚌 Transport"}</option>
                <option value="hotel">{isArabic ? "فندق" : "🏨 Hotel"}</option>
                <option value="meal">{isArabic ? "وجبة" : "🍽️ Meal"}</option>
                <option value="flight">{isArabic ? "طيران" : "✈️ Flight"}</option>
                <option value="cruise">{isArabic ? "كروز" : "🚢 Cruise"}</option>
                <option value="other">{isArabic ? "أخرى" : "📌 Other"}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={() => editingItem && saveItemMutation.mutate({ dayId: editingItem.dayId, item: editingItem.item })} disabled={!itemForm.title.trim() || saveItemMutation.isPending} className="gap-1.5">
              {saveItemMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" />{isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Edit Dialog */}
      <Dialog open={!!editingDay} onOpenChange={() => setEditingDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isArabic ? "تعديل اليوم" : "Edit Day"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-xs">{isArabic ? "العنوان" : "Title"}</Label><Input value={dayForm.title} onChange={(e) => setDayForm({ ...dayForm, title: e.target.value })} className="mt-1" /></div>
            <div><Label className="text-xs">{isArabic ? "المدينة" : "City"}</Label><Input value={dayForm.city} onChange={(e) => setDayForm({ ...dayForm, city: e.target.value })} className="mt-1" /></div>
            <div><Label className="text-xs">{isArabic ? "الوصف" : "Description"}</Label><Textarea value={dayForm.description} onChange={(e) => setDayForm({ ...dayForm, description: e.target.value })} rows={2} className="mt-1 text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDay(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={() => editingDay && updateDayMutation.mutate(editingDay)} disabled={updateDayMutation.isPending} className="gap-1.5">
              {updateDayMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" />{isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Option Dialog */}
      <Dialog open={!!editingOption} onOpenChange={() => setEditingOption(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingOption === "new" ? (isArabic ? "إضافة خيار" : "Add Option") : (isArabic ? "تعديل خيار" : "Edit Option")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-xs">{isArabic ? "العنوان" : "Title"} *</Label><Input value={optionForm.title} onChange={(e) => setOptionForm({ ...optionForm, title: e.target.value })} placeholder={isArabic ? "مثال: 3 ليالي من أسوان" : "e.g., 3 Nights from Aswan to Esna"} className="mt-1" /></div>
            <div><Label className="text-xs">{isArabic ? "الوصف" : "Description"}</Label><Textarea value={optionForm.description} onChange={(e) => setOptionForm({ ...optionForm, description: e.target.value })} rows={2} className="mt-1 text-xs" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">{isArabic ? "عدد الليالي" : "Nights"}</Label><Input type="number" min={1} value={optionForm.duration_nights} onChange={(e) => setOptionForm({ ...optionForm, duration_nights: parseInt(e.target.value) || 1 })} className="mt-1" /></div>
              <div><Label className="text-xs">{isArabic ? "المغادرة من" : "Departure from"}</Label><Input value={optionForm.departure_from} onChange={(e) => setOptionForm({ ...optionForm, departure_from: e.target.value })} placeholder={isArabic ? "أسوان" : "Aswan"} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOption(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={() => saveOptionMutation.mutate(editingOption !== "new" ? editingOption! : undefined)} disabled={!optionForm.title.trim() || saveOptionMutation.isPending} className="gap-1.5">
              {saveOptionMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" />{isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inclusion Dialog */}
      <Dialog open={!!editingInclusion} onOpenChange={() => setEditingInclusion(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingInclusion?.type === "include" ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" />{isArabic ? "يشمل" : "Included"}</> : <><XCircle className="w-4 h-4 text-red-500" />{isArabic ? "لا يشمل" : "Excluded"}</>}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs">{isArabic ? "المحتوى" : "Content"} *</Label>
            <Textarea value={inclusionForm} onChange={(e) => setInclusionForm(e.target.value)} placeholder={isArabic ? "مثال: الإفطار يوميًا" : "e.g., Daily breakfast"} rows={2} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInclusion(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={() => editingInclusion && saveInclusionMutation.mutate({ type: editingInclusion.type, item: editingInclusion.item })} disabled={!inclusionForm.trim() || saveInclusionMutation.isPending} className="gap-1.5">
              {saveInclusionMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" />{isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability Dialog */}
      <Dialog open={!!editingAvail} onOpenChange={() => setEditingAvail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingAvail === "new" ? (isArabic ? "إضافة موعد" : "Add Schedule") : (isArabic ? "تعديل موعد" : "Edit Schedule")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">{isArabic ? "اليوم" : "Day of Week"} *</Label>
              <select value={availForm.day_of_week} onChange={(e) => setAvailForm({ ...availForm, day_of_week: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">{isArabic ? "المغادرة من" : "Departure from"} *</Label><Input value={availForm.departure_from} onChange={(e) => setAvailForm({ ...availForm, departure_from: e.target.value })} placeholder={isArabic ? "إسنا" : "Esna"} className="mt-1" /></div>
            <div><Label className="text-xs">{isArabic ? "ملاحظات" : "Notes"}</Label><Input value={availForm.notes} onChange={(e) => setAvailForm({ ...availForm, notes: e.target.value })} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAvail(null)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={() => saveAvailMutation.mutate(editingAvail !== "new" ? editingAvail! : undefined)} disabled={!availForm.departure_from.trim() || saveAvailMutation.isPending} className="gap-1.5">
              {saveAvailMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}<Save className="w-4 h-4" />{isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
