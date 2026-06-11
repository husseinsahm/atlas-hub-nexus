import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { extractRecipeFromBooking } from "@/lib/recipes";
import { BookOpen, Loader2, Tag } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
  defaultName?: string;
  defaultDestination?: string;
  defaultDurationDays?: number;
}

export function SaveAsRecipeDialog({
  open,
  onOpenChange,
  bookingId,
  defaultName = "",
  defaultDestination = "",
  defaultDurationDays,
}: Props) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isArabic = language === "ar";
  const companyId = user?.activeMembership?.companyId;

  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [destination, setDestination] = useState(defaultDestination);
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!companyId || !user?.id || !name.trim()) {
      toast({ title: isArabic ? "أدخل اسم للوصفة" : "Enter a recipe name", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const structure = await extractRecipeFromBooking(bookingId);
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { error } = await supabase.from("booking_recipes").insert({
        company_id: companyId,
        name: name.trim(),
        description: description.trim() || null,
        source_booking_id: bookingId,
        destination: destination.trim() || null,
        duration_days: defaultDurationDays ?? structure.total_days,
        tags,
        structure: structure as any,
        version: 1,
        created_by: user.id,
      });
      if (error) throw error;

      toast({ title: isArabic ? "تم حفظ الوصفة" : "Recipe saved" });
      onOpenChange(false);
      setName("");
      setDescription("");
      setDestination("");
      setTagsInput("");
    } catch (e: any) {
      toast({
        title: isArabic ? "تعذر حفظ الوصفة" : "Failed to save recipe",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <ModalDarkHeader
          icon={BookOpen}
          title={isArabic ? "حفظ كوصفة" : "Save as Recipe"}
          subtitle={
            isArabic
              ? "خزّن هذا الحجز كقالب لإعادة الاستخدام لاحقاً"
              : "Snapshot this booking as a reusable template"
          }
        />
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>{isArabic ? "اسم الوصفة" : "Recipe name"} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isArabic ? "مثال: تركيا الكلاسيكية 7 أيام" : "e.g. Classic Turkey 7 Days"}
            />
          </div>
          <div className="space-y-2">
            <Label>{isArabic ? "الوصف" : "Description"}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={isArabic ? "ملاحظات داخلية..." : "Internal notes..."}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{isArabic ? "الوجهة" : "Destination"}</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Istanbul" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                {isArabic ? "الوسوم" : "Tags"}
              </Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder={isArabic ? "عائلي, شهر عسل" : "family, honeymoon"}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isArabic
              ? "سيتم استخراج الأيام، البنود، والخدمات دون أي بيانات عميل."
              : "Days, items and services will be captured. No client data is stored."}
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {isArabic ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <BookOpen className="w-4 h-4 me-2" />}
            {isArabic ? "حفظ الوصفة" : "Save Recipe"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
