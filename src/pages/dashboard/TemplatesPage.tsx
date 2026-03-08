import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, Plus, Calendar, MapPin, Loader2, FileText, 
  ChevronRight, Copy, Trash2, Edit, MoreVertical, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export default function TemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;
  const isArabic = language === "ar";

  const [search, setSearch] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: "",
    description: "",
    total_days: 1,
  });

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
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("itinerary_templates")
        .insert({
          company_id: companyId!,
          title: newTemplate.title.trim(),
          description: newTemplate.description.trim() || null,
          total_days: newTemplate.total_days,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Create empty days
      const days = Array.from({ length: newTemplate.total_days }, (_, i) => ({
        template_id: data.id,
        day_number: i + 1,
        title: `Day ${i + 1}`,
      }));
      await supabase.from("template_days").insert(days);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["itinerary-templates"] });
      setShowNewDialog(false);
      setNewTemplate({ title: "", description: "", total_days: 1 });
      toast({ title: isArabic ? "تم إنشاء القالب" : "Template created" });
      navigate(`/dashboard/templates/${data.id}`);
    },
  });

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

  return (
    <div className="space-y-6">
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
        <Button onClick={() => setShowNewDialog(true)} className="gold-gradient text-accent-foreground gap-2">
          <Plus className="w-4 h-4" />
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
            <Plus className="w-4 h-4" />
            {isArabic ? "إنشاء قالب" : "Create Template"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template: any, idx: number) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="border-border hover:shadow-md hover:border-foreground/10 transition-all group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">{template.title}</h3>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {template.total_days} {isArabic ? "يوم" : "days"}
                        </Badge>
                        {template.is_active ? (
                          <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-0">
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
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/dashboard/templates/${template.id}`)}>
                          <Edit className="w-3.5 h-3.5 mr-2" />
                          {isArabic ? "تعديل" : "Edit"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/dashboard/templates/${template.id}`)}>
                          <Eye className="w-3.5 h-3.5 mr-2" />
                          {isArabic ? "عرض" : "View"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteMutation.mutate(template.id)}
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
          ))}
        </div>
      )}

      {/* New Template Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              {isArabic ? "قالب جديد" : "New Itinerary Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs">{isArabic ? "اسم القالب" : "Template Name"} *</Label>
              <Input
                value={newTemplate.title}
                onChange={e => setNewTemplate({ ...newTemplate, title: e.target.value })}
                placeholder={isArabic ? "مثال: برنامج دبي 5 أيام" : "e.g., Dubai 5-Day Classic"}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">{isArabic ? "الوصف" : "Description"}</Label>
              <Textarea
                value={newTemplate.description}
                onChange={e => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder={isArabic ? "وصف مختصر للقالب..." : "Brief description..."}
                rows={2}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">{isArabic ? "عدد الأيام" : "Number of Days"}</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={newTemplate.total_days}
                onChange={e => setNewTemplate({ ...newTemplate, total_days: parseInt(e.target.value) || 1 })}
                className="mt-1 w-24"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={() => createMutation.mutate()} 
              disabled={!newTemplate.title.trim() || createMutation.isPending}
              className="gold-gradient text-accent-foreground gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isArabic ? "إنشاء القالب" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
