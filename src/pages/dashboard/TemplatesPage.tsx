import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, Plus, Calendar, MapPin, Loader2, FileText, 
  ChevronRight, Copy, Trash2, Edit, MoreVertical, Eye,
  Sparkles, Wand2, Globe, Link, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MultiCityAutocomplete } from "@/components/ui/multi-city-autocomplete";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LockOverlay } from "@/components/plan/LockOverlay";

export default function TemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;
  const isArabic = language === "ar";
  const { limits } = usePlanLimits();

  const [search, setSearch] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [enableAI, setEnableAI] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: "",
    description: "",
    total_days: 7,
    cities: [] as string[],
    trip_type: "",
  });

  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-itinerary", {
        body: { url: importUrl.trim(), language: isArabic ? "ar" : "en" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const it = data?.itinerary;
      if (it) {
        setNewTemplate({
          title: it.title || "",
          description: it.description || "",
          total_days: it.total_days || 7,
          cities: Array.isArray(it.destinations) ? it.destinations : [],
          trip_type: it.trip_type || "",
        });
        // Store the full AI itinerary for creation
        setImportedItinerary(it);
        setImportMode(false);
        toast({
          title: isArabic ? "تم الاستيراد بنجاح" : "Imported successfully",
          description: isArabic
            ? `تم استخراج "${it.title}" - ${it.total_days} أيام`
            : `Extracted "${it.title}" - ${it.total_days} days`,
        });
      }
    } catch (e: any) {
      console.error("Import error:", e);
      toast({
        title: isArabic ? "فشل الاستيراد" : "Import failed",
        description: e?.message || (isArabic ? "تعذر استخراج البرنامج من الرابط" : "Could not extract itinerary from URL"),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const [importedItinerary, setImportedItinerary] = useState<any>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["itinerary-templates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itinerary_templates")
        .select("*")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (aiItinerary?: any) => {
      // Create template
      const { data: templateData, error: templateError } = await supabase
        .from("itinerary_templates")
        .insert({
          company_id: companyId!,
          title: newTemplate.title.trim(),
          description: newTemplate.description.trim() || null,
          total_days: newTemplate.total_days,
          destinations: newTemplate.cities.length > 0 ? newTemplate.cities : null,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (templateError) throw templateError;

      // Create days from AI itinerary or empty
      if (aiItinerary?.days && Array.isArray(aiItinerary.days)) {
        for (const day of aiItinerary.days) {
          const { data: dayData, error: dayError } = await supabase
            .from("template_days")
            .insert({
              template_id: templateData.id,
              day_number: day.day_number,
              title: day.title || `Day ${day.day_number}`,
              description: day.description || null,
              city: day.city || null,
            })
            .select("id")
            .single();
          
          if (dayError) {
            console.error("Day insert error:", dayError);
            continue;
          }

          // Create day items if available
          if (day.items && Array.isArray(day.items) && dayData) {
            const itemsToInsert = day.items.map((item: any, idx: number) => ({
              template_day_id: dayData.id,
              category: item.category || "activity",
              custom_title: item.title || "",
              custom_description: item.description || null,
              duration_minutes: item.duration_minutes || null,
              sort_order: idx,
            }));
            
            await supabase.from("template_day_items").insert(itemsToInsert);
          }
        }
      } else {
        // Create empty days
        const days = Array.from({ length: newTemplate.total_days }, (_, i) => ({
          template_id: templateData.id,
          day_number: i + 1,
          title: `Day ${i + 1}`,
        }));
        await supabase.from("template_days").insert(days);
      }

      return templateData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["itinerary-templates"] });
      setShowNewDialog(false);
      setNewTemplate({ title: "", description: "", total_days: 7, cities: [], trip_type: "" });
      setEnableAI(true);
      toast({ title: isArabic ? "تم إنشاء القالب" : "Template created" });
      navigate(`/dashboard/templates/${data.id}`);
    },
  });

  const handleCreate = async () => {
    if (enableAI && newTemplate.title.trim()) {
      setIsGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke("generate-template", {
          body: {
            title: newTemplate.title.trim(),
            totalDays: newTemplate.total_days,
            cities: newTemplate.cities,
            description: newTemplate.description.trim(),
            tripType: newTemplate.trip_type,
            language: isArabic ? "ar" : "en",
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        await createMutation.mutateAsync(data?.itinerary);
      } catch (e: any) {
        console.error("AI generation error:", e);
        toast({
          title: isArabic ? "تحذير" : "Warning",
          description: isArabic 
            ? "فشل الإنشاء بالذكاء الاصطناعي، سيتم إنشاء قالب فارغ"
            : "AI generation failed, creating empty template",
          variant: "destructive",
        });
        await createMutation.mutateAsync(undefined);
      } finally {
        setIsGenerating(false);
      }
    } else {
      createMutation.mutate(undefined);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("itinerary_templates").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itinerary-templates"] });
      toast({ title: isArabic ? "تم حذف القالب" : "Template deleted" });
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter((t: any) =>
      t.title?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  }, [templates, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const isLocked = !limits.features.includes("custom_templates") && limits.planSlug !== "professional" && limits.planSlug !== "enterprise";

  return (
    <div className="space-y-6 relative">
      {isLocked && (
        <LockOverlay planRequired="Professional" featureName="Custom Templates" />
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            {isArabic ? "قوالب البرامج" : "Itinerary Templates"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isArabic ? "قوالب برامج سياحية جاهزة للاستخدام" : "Reusable itinerary templates for quick booking setup"}
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)} className="gold-gradient text-accent-foreground gap-2" disabled={isLocked}>
          <Sparkles className="w-4 h-4" />
          {isArabic ? "قالب جديد" : "New Template"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder={isArabic ? "بحث في القوالب..." : "Search templates..."} 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="pl-10" 
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">
            {isArabic ? "لا توجد قوالب" : "No templates yet"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            {isArabic 
              ? "أنشئ قوالب برامج جاهزة لاستخدامها في الحجوزات"
              : "Create reusable itinerary templates to speed up booking creation"
            }
          </p>
          <Button onClick={() => setShowNewDialog(true)} variant="outline" className="mt-4 gap-2">
            <Sparkles className="w-4 h-4" />
            {isArabic ? "إنشاء قالب بالذكاء الاصطناعي" : "Create with AI"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template: any, idx: number) => {
            const destinations = Array.isArray(template.destinations) ? template.destinations : [];
            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="border-border hover:shadow-md hover:border-foreground/10 transition-all group cursor-pointer" onClick={() => navigate(`/dashboard/templates/${template.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-foreground truncate">{template.title}</h3>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {template.total_days} {isArabic ? "يوم" : "days"}
                          </Badge>
                          {destinations.length > 0 && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Globe className="w-2.5 h-2.5" />
                              {destinations.slice(0, 2).join(", ")}
                              {destinations.length > 2 && ` +${destinations.length - 2}`}
                            </Badge>
                          )}
                          {template.is_active ? (
                            <Badge className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                              {isArabic ? "نشط" : "Active"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {isArabic ? "غير نشط" : "Inactive"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {isArabic ? "تم الإنشاء" : "Created"} {format(new Date(template.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/templates/${template.id}`); }}>
                            <Edit className="w-3.5 h-3.5 mr-2" />
                            {isArabic ? "تعديل" : "Edit"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/templates/${template.id}`); }}>
                            <Eye className="w-3.5 h-3.5 mr-2" />
                            {isArabic ? "عرض" : "View"}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(template.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            {isArabic ? "حذف" : "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New Template Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden dark-header-dialog">
          <ModalDarkHeader
            icon={<Sparkles className="w-5 h-5 text-accent-foreground" />}
            title={isArabic ? "قالب جديد" : "New Itinerary Template"}
            description={isArabic ? "أنشئ قالبًا جديدًا بالذكاء الاصطناعي" : "Create a template with AI assistance"}
          />

          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* AI Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                <Label htmlFor="ai-toggle" className="text-sm font-medium cursor-pointer">
                  {isArabic ? "إنشاء بالذكاء الاصطناعي" : "Generate with AI"}
                </Label>
              </div>
              <Switch
                id="ai-toggle"
                checked={enableAI}
                onCheckedChange={setEnableAI}
              />
            </div>

            <div>
              <Label className="text-xs">{isArabic ? "اسم القالب" : "Template Name"} *</Label>
              <Input
                value={newTemplate.title}
                onChange={e => setNewTemplate({ ...newTemplate, title: e.target.value })}
                placeholder={isArabic ? "مثال: برنامج اليابان الكلاسيكي" : "e.g., Classic Japan Adventure"}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">{isArabic ? "الوصف" : "Description"}</Label>
              <Textarea
                value={newTemplate.description}
                onChange={e => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder={isArabic ? "وصف مختصر للقالب..." : "Brief description of the template..."}
                rows={2}
                className="mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">{isArabic ? "عدد الأيام" : "Number of Days"}</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={newTemplate.total_days}
                  onChange={e => setNewTemplate({ ...newTemplate, total_days: parseInt(e.target.value) || 1 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{isArabic ? "نوع الرحلة" : "Trip Type"}</Label>
                <Input
                  value={newTemplate.trip_type}
                  onChange={e => setNewTemplate({ ...newTemplate, trip_type: e.target.value })}
                  placeholder={isArabic ? "عائلي، رومانسي..." : "Family, Romantic..."}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">{isArabic ? "المدن والوجهات" : "Cities & Destinations"}</Label>
              <MultiCityAutocomplete
                value={newTemplate.cities}
                onValueChange={(cities) => setNewTemplate({ ...newTemplate, cities })}
                placeholder={isArabic ? "أضف المدن..." : "Add cities..."}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {isArabic 
                  ? "الذكاء الاصطناعي سيوزع الأيام على هذه المدن تلقائياً"
                  : "AI will distribute days across these cities automatically"
                }
              </p>
            </div>

            {enableAI && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    {isArabic 
                      ? "سيقوم الذكاء الاصطناعي بإنشاء برنامج كامل يتضمن عناوين الأيام والأنشطة والفنادق والنقل بناءً على المعلومات المدخلة."
                      : "AI will generate a complete itinerary with day titles, activities, hotels, and transfers based on your input."
                    }
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-muted/30">
            <Button variant="outline" onClick={() => setShowNewDialog(false)} disabled={isGenerating || createMutation.isPending}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!newTemplate.title.trim() || isGenerating || createMutation.isPending}
              className="gold-gradient text-accent-foreground gap-2"
            >
              {(isGenerating || createMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {isGenerating ? (
                isArabic ? "جاري الإنشاء بالذكاء الاصطناعي..." : "Generating with AI..."
              ) : (
                <>
                  {enableAI && <Sparkles className="w-4 h-4" />}
                  {isArabic ? "إنشاء القالب" : "Create Template"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
