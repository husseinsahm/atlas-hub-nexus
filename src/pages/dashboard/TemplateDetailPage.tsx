import { useState } from "react";
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
  GripVertical, Loader2, Save, MapPin, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isArabic = language === "ar";
  const companyId = user?.activeMembership?.companyId;

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ dayId: string; item?: TemplateDayItem } | null>(null);
  const [editingDay, setEditingDay] = useState<TemplateDay | null>(null);
  const [itemForm, setItemForm] = useState({ title: "", description: "", category: "activity" });
  const [dayForm, setDayForm] = useState({ title: "", description: "", city: "" });

  // Fetch template
  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ["template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itinerary_templates")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch days with items
  const { data: days = [], isLoading: daysLoading } = useQuery({
    queryKey: ["template-days", id],
    queryFn: async () => {
      const { data: daysData, error: daysError } = await supabase
        .from("template_days")
        .select("*")
        .eq("template_id", id!)
        .order("day_number", { ascending: true });
      if (daysError) throw daysError;

      const dayIds = daysData.map((d) => d.id);
      let items: TemplateDayItem[] = [];
      if (dayIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("template_day_items")
          .select("*")
          .in("template_day_id", dayIds)
          .order("sort_order", { ascending: true });
        if (!itemsError && itemsData) items = itemsData as TemplateDayItem[];
      }

      return daysData.map((day) => ({
        ...day,
        items: items.filter((i) => i.template_day_id === day.id),
      })) as TemplateDay[];
    },
    enabled: !!id,
  });

  const toggleDay = (dayId: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(dayId) ? next.delete(dayId) : next.add(dayId);
      return next;
    });
  };

  // Add/Update item mutation
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
          async () => {
            const res = await supabase.from("template_day_items").update(payload).eq("id", item.id).select("*").single();
            return { data: res.data, error: res.error, status: res.status, statusText: res.statusText };
          }
        );
      } else {
        return runMutationWithRetry(
          { table: "template_day_items", operation: "insert", payload, userId: user?.id, companyId, fallback: { select: "*", single: true } },
          async () => {
            const res = await supabase.from("template_day_items").insert(payload).select("*").single();
            return { data: res.data, error: res.error, status: res.status, statusText: res.statusText };
          }
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-days", id] });
      setEditingItem(null);
      setItemForm({ title: "", description: "", category: "activity" });
      toast({ title: isArabic ? "تم الحفظ" : "Item saved" });
    },
    onError: (err) => {
      toast({ title: getMutationErrorMessage(err), variant: "destructive" });
    },
  });

  // Delete item
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return runMutationWithRetry(
        { table: "template_day_items", operation: "delete", userId: user?.id, companyId, fallback: { filters: [{ column: "id", value: itemId }] } },
        async () => {
          const res = await supabase.from("template_day_items").delete().eq("id", itemId).select("*");
          return { data: res.data, error: res.error, status: res.status, statusText: res.statusText };
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-days", id] });
      toast({ title: isArabic ? "تم الحذف" : "Item deleted" });
    },
    onError: (err) => {
      toast({ title: getMutationErrorMessage(err), variant: "destructive" });
    },
  });

  // Add day
  const addDayMutation = useMutation({
    mutationFn: async () => {
      const nextNumber = days.length > 0 ? Math.max(...days.map((d) => d.day_number)) + 1 : 1;
      const payload = { template_id: id!, day_number: nextNumber, title: `Day ${nextNumber}` };
      return runMutationWithRetry(
        { table: "template_days", operation: "insert", payload, userId: user?.id, companyId, fallback: { select: "*", single: true } },
        async () => {
          const res = await supabase.from("template_days").insert(payload).select("*").single();
          return { data: res.data, error: res.error, status: res.status, statusText: res.statusText };
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-days", id] });
      toast({ title: isArabic ? "تمت إضافة يوم" : "Day added" });
    },
    onError: (err) => {
      toast({ title: getMutationErrorMessage(err), variant: "destructive" });
    },
  });

  // Update day
  const updateDayMutation = useMutation({
    mutationFn: async (day: TemplateDay) => {
      const payload = { title: dayForm.title.trim() || null, description: dayForm.description.trim() || null, city: dayForm.city.trim() || null };
      return runMutationWithRetry(
        { table: "template_days", operation: "update", payload, userId: user?.id, companyId, fallback: { filters: [{ column: "id", value: day.id }], select: "*", single: true } },
        async () => {
          const res = await supabase.from("template_days").update(payload).eq("id", day.id).select("*").single();
          return { data: res.data, error: res.error, status: res.status, statusText: res.statusText };
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-days", id] });
      setEditingDay(null);
      toast({ title: isArabic ? "تم تحديث اليوم" : "Day updated" });
    },
    onError: (err) => {
      toast({ title: getMutationErrorMessage(err), variant: "destructive" });
    },
  });

  // Delete day
  const deleteDayMutation = useMutation({
    mutationFn: async (dayId: string) => {
      // Delete items first
      await supabase.from("template_day_items").delete().eq("template_day_id", dayId);
      return runMutationWithRetry(
        { table: "template_days", operation: "delete", userId: user?.id, companyId, fallback: { filters: [{ column: "id", value: dayId }] } },
        async () => {
          const res = await supabase.from("template_days").delete().eq("id", dayId).select("*");
          return { data: res.data, error: res.error, status: res.status, statusText: res.statusText };
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-days", id] });
      toast({ title: isArabic ? "تم حذف اليوم" : "Day deleted" });
    },
    onError: (err) => {
      toast({ title: getMutationErrorMessage(err), variant: "destructive" });
    },
  });

  const openItemDialog = (dayId: string, item?: TemplateDayItem) => {
    setEditingItem({ dayId, item });
    setItemForm({
      title: item?.custom_title || "",
      description: item?.custom_description || "",
      category: item?.category || "activity",
    });
  };

  const openDayDialog = (day: TemplateDay) => {
    setEditingDay(day);
    setDayForm({ title: day.title || "", description: day.description || "", city: day.city || "" });
  };

  if (templateLoading || daysLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{isArabic ? "القالب غير موجود" : "Template not found"}</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/templates")} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isArabic ? "رجوع" : "Back"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/templates")} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold font-display text-foreground truncate">{template.title}</h1>
          {template.description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Calendar className="w-3 h-3" />
            {template.total_days} {isArabic ? "يوم" : "days"}
          </Badge>
        </div>
      </div>

      {/* Itinerary Section */}
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">
            {isArabic ? "البرنامج اليومي" : "Itinerary"}
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => addDayMutation.mutate()}
            disabled={addDayMutation.isPending}
            className="gap-1.5 text-xs"
          >
            {addDayMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {isArabic ? "إضافة يوم" : "Add Day"}
          </Button>
        </div>

        {days.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد أيام بعد" : "No days yet"}</p>
              <Button size="sm" variant="outline" onClick={() => addDayMutation.mutate()} className="mt-3 gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                {isArabic ? "إضافة يوم" : "Add Day"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {days.map((day) => {
              const isExpanded = expandedDays.has(day.id);
              return (
                <Card key={day.id} className="border-border overflow-hidden">
                  {/* Day Header */}
                  <button
                    onClick={() => toggleDay(day.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
                      "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-semibold text-sm">
                        {day.title || `${isArabic ? "اليوم" : "Day"} ${day.day_number}`}
                      </span>
                      {day.city && (
                        <Badge variant="secondary" className="text-[10px] bg-primary-foreground/15 text-primary-foreground border-0 gap-1">
                          <MapPin className="w-2.5 h-2.5" />
                          {day.city}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-primary-foreground/60">
                        {day.items.length} {isArabic ? "عنصر" : "items"}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Day Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-2">
                          {day.description && (
                            <p className="text-xs text-muted-foreground italic mb-3">{day.description}</p>
                          )}

                          {/* Items */}
                          {day.items.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              {isArabic ? "لا توجد عناصر" : "No items yet"}
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {day.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                                >
                                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground">{item.custom_title || isArabic ? item.custom_title : "Untitled"}</p>
                                    {item.custom_description && (
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.custom_description}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openItemDialog(day.id, item)}>
                                      <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() => deleteItemMutation.mutate(item.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Day Actions */}
                          <div className="flex items-center gap-2 pt-2 border-t border-border mt-3">
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={() => openItemDialog(day.id)}>
                              <Plus className="w-3 h-3" />
                              {isArabic ? "إضافة عنصر" : "Add Item"}
                            </Button>
                            <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => openDayDialog(day)}>
                              <Edit className="w-3 h-3" />
                              {isArabic ? "تعديل" : "Edit"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs gap-1 text-destructive hover:text-destructive"
                              onClick={() => deleteDayMutation.mutate(day.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                              {isArabic ? "حذف" : "Delete"}
                            </Button>
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

      {/* Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem?.item
                ? (isArabic ? "تعديل عنصر" : "Edit Item")
                : (isArabic ? "إضافة عنصر" : "Add Item")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">{isArabic ? "العنوان" : "Title"} *</Label>
              <Input
                value={itemForm.title}
                onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                placeholder={isArabic ? "مثال: زيارة المعبد" : "e.g., Visit Philae Temple"}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "الوصف" : "Description"}</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                placeholder={isArabic ? "وصف اختياري..." : "Optional description..."}
                rows={2}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "التصنيف" : "Category"}</Label>
              <select
                value={itemForm.category}
                onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="activity">{isArabic ? "نشاط" : "Activity"}</option>
                <option value="transport">{isArabic ? "نقل" : "Transport"}</option>
                <option value="hotel">{isArabic ? "فندق" : "Hotel"}</option>
                <option value="meal">{isArabic ? "وجبة" : "Meal"}</option>
                <option value="other">{isArabic ? "أخرى" : "Other"}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => editingItem && saveItemMutation.mutate({ dayId: editingItem.dayId, item: editingItem.item })}
              disabled={!itemForm.title.trim() || saveItemMutation.isPending}
              className="gap-1.5"
            >
              {saveItemMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              {isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Day Edit Dialog */}
      <Dialog open={!!editingDay} onOpenChange={() => setEditingDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isArabic ? "تعديل اليوم" : "Edit Day"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">{isArabic ? "العنوان" : "Title"}</Label>
              <Input
                value={dayForm.title}
                onChange={(e) => setDayForm({ ...dayForm, title: e.target.value })}
                placeholder={isArabic ? "عنوان اليوم" : "Day title"}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "المدينة" : "City"}</Label>
              <Input
                value={dayForm.city}
                onChange={(e) => setDayForm({ ...dayForm, city: e.target.value })}
                placeholder={isArabic ? "اسم المدينة" : "City name"}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">{isArabic ? "الوصف" : "Description"}</Label>
              <Textarea
                value={dayForm.description}
                onChange={(e) => setDayForm({ ...dayForm, description: e.target.value })}
                rows={2}
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDay(null)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => editingDay && updateDayMutation.mutate(editingDay)}
              disabled={updateDayMutation.isPending}
              className="gap-1.5"
            >
              {updateDayMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              {isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
