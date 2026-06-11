import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { generateBookingNumber, instantiateBookingFromRecipe } from "@/lib/recipes";
import { Library, Loader2, Plus, Search, Trash2, MapPin, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function RecipeLibraryDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isArabic = language === "ar";
  const companyId = user?.activeMembership?.companyId;

  const [search, setSearch] = useState("");
  const [creatingFromId, setCreatingFromId] = useState<string | null>(null);

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["booking-recipes", companyId],
    enabled: !!companyId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_recipes")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = recipes.filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.destination?.toLowerCase().includes(q) ||
      (r.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
  });

  const handleUse = async (recipeId: string) => {
    if (!companyId || !user?.id) return;
    setCreatingFromId(recipeId);
    try {
      const bookingNumber = await generateBookingNumber(companyId);
      const { id } = await instantiateBookingFromRecipe({
        recipeId,
        companyId,
        userId: user.id,
        bookingNumber,
      });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-recipes", companyId] });
      toast({ title: isArabic ? "تم إنشاء الحجز من الوصفة" : "Booking created from recipe" });
      onOpenChange(false);
      navigate(`/dashboard/bookings/${id}`);
    } catch (e: any) {
      toast({
        title: isArabic ? "تعذر إنشاء الحجز" : "Failed to create booking",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setCreatingFromId(null);
    }
  };

  const handleDelete = async (recipeId: string) => {
    if (!confirm(isArabic ? "حذف هذه الوصفة؟" : "Delete this recipe?")) return;
    const { error } = await supabase
      .from("booking_recipes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", recipeId);
    if (error) {
      toast({ title: isArabic ? "تعذر الحذف" : "Failed to delete", variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["booking-recipes", companyId] });
    toast({ title: isArabic ? "تم الحذف" : "Recipe deleted" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 max-h-[85vh] flex flex-col">
        <ModalDarkHeader
          icon={<Library className="w-5 h-5" />}
          title={isArabic ? "مكتبة الوصفات" : "Recipe Library"}
          description={
            isArabic
              ? "ابدأ ملف حجز جديد من قالب جاهز خلال ثوانٍ"
              : "Launch a brand-new booking file from a proven template in seconds"
          }
        />

        <div className="p-4 border-b bg-muted/20">
          <div className="relative">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isArabic ? "ابحث بالاسم، الوجهة أو الوسم..." : "Search by name, destination or tag..."}
              className="ps-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Library className="w-12 h-12 text-muted-foreground/40 mb-3" />
              <p className="font-medium">
                {recipes.length === 0
                  ? isArabic
                    ? "لا توجد وصفات بعد"
                    : "No recipes yet"
                  : isArabic
                    ? "لا توجد نتائج"
                    : "No results"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {isArabic
                  ? "افتح أي حجز ناجح واستخدم \"حفظ كوصفة\" من قائمة الإجراءات السريعة."
                  : "Open any successful booking and use \"Save as Recipe\" from the Quick Actions menu."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((r: any) => (
                <div
                  key={r.id}
                  className="border rounded-[14px] p-4 bg-card hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{r.name}</h3>
                        <Badge variant="outline" className="text-xs">v{r.version}</Badge>
                        {r.usage_count > 0 && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {r.usage_count}× {isArabic ? "استخدام" : "used"}
                          </Badge>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {r.destination && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {r.destination}
                          </span>
                        )}
                        {r.duration_days && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {r.duration_days} {isArabic ? "أيام" : "days"}
                          </span>
                        )}
                        {r.last_used_at && (
                          <span>
                            {isArabic ? "آخر استخدام:" : "Last used:"} {format(new Date(r.last_used_at), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      {(r.tags || []).length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {r.tags.map((t: string) => (
                            <Badge key={t} variant="outline" className="text-[10px] py-0">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleUse(r.id)}
                        disabled={creatingFromId === r.id}
                      >
                        {creatingFromId === r.id ? (
                          <Loader2 className="w-3.5 h-3.5 me-1.5 animate-spin" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 me-1.5" />
                        )}
                        {isArabic ? "حجز جديد" : "New Booking"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
