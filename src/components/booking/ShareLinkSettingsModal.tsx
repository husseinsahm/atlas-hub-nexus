import { useState, useEffect } from "react";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Lock, Calendar as CalendarIcon, Loader2, Copy, ExternalLink,
  Shield, Clock, Eye, EyeOff, Link2, Trash2, CheckCircle, Languages, Sparkles,
} from "lucide-react";

// Available languages for AI translation
const TRANSLATION_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇬🇧" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵" },
  { code: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸" },
  { code: "fr", label: "French", nativeLabel: "Français", flag: "🇫🇷" },
  { code: "zh", label: "Chinese", nativeLabel: "中文", flag: "🇨🇳" },
] as const;

type TranslationLangCode = typeof TRANSLATION_LANGUAGES[number]["code"];

interface ShareToken {
  id: string;
  token: string;
  booking_id: string;
  company_id: string;
  is_active: boolean;
  expires_at: string | null;
  metadata: {
    password_hash?: string;
    password_hint?: string;
    translations?: Record<string, any>;
    available_languages?: string[];
  } | null;
  created_at: string;
}

interface ShareLinkSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  companyId: string;
  userId?: string;
  shareTokens: ShareToken[];
  onRefetch: () => void;
  isArabic?: boolean;
  bookingData?: {
    title: string;
    description?: string;
    days?: Array<{
      title?: string;
      description?: string;
      short_description?: string;
      city?: string;
      pickup_location?: string;
      dropoff_location?: string;
      items?: Array<{
        custom_title?: string;
        custom_description?: string;
      }>;
    }>;
  };
}

// Simple hash function for password (for demo - in production use bcrypt on server)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

export function ShareLinkSettingsModal({
  open,
  onOpenChange,
  bookingId,
  companyId,
  userId,
  shareTokens,
  onRefetch,
  isArabic = false,
  bookingData,
}: ShareLinkSettingsModalProps) {
  const { toast } = useToast();

  // Form state
  const [enablePassword, setEnablePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enableExpiration, setEnableExpiration] = useState(false);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [expirationPreset, setExpirationPreset] = useState("");
  
  // AI Translation state
  const [enableTranslation, setEnableTranslation] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<Set<TranslationLangCode>>(new Set(["en"]));
  const [isTranslating, setIsTranslating] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setEnablePassword(false);
      setPassword("");
      setEnableExpiration(false);
      setExpirationDate(undefined);
      setExpirationPreset("");
      setEnableTranslation(false);
      setSelectedLanguages(new Set(["en"]));
    }
  }, [open]);

  const toggleLanguage = (lang: TranslationLangCode) => {
    setSelectedLanguages(prev => {
      const next = new Set(prev);
      if (next.has(lang)) {
        // Don't allow removing all languages
        if (next.size > 1) next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  };

  const handlePresetChange = (preset: string) => {
    setExpirationPreset(preset);
    const now = new Date();
    switch (preset) {
      case "1d": setExpirationDate(addDays(now, 1)); break;
      case "3d": setExpirationDate(addDays(now, 3)); break;
      case "1w": setExpirationDate(addWeeks(now, 1)); break;
      case "2w": setExpirationDate(addWeeks(now, 2)); break;
      case "1m": setExpirationDate(addMonths(now, 1)); break;
      case "3m": setExpirationDate(addMonths(now, 3)); break;
      default: setExpirationDate(undefined);
    }
  };

  const createLink = useMutation({
    mutationFn: async () => {
      const metadata: { 
        password_hash?: string;
        translations?: Record<string, any>;
        available_languages?: string[];
      } = {};
      
      if (enablePassword && password.trim()) {
        metadata.password_hash = await hashPassword(password.trim());
      }

      // Handle AI translation if enabled
      if (enableTranslation && selectedLanguages.size > 1 && bookingData) {
        setIsTranslating(true);
        
        // Prepare content for translation
        const contentToTranslate = {
          title: bookingData.title,
          description: bookingData.description || "",
          days: bookingData.days?.map(day => ({
            title: day.title || "",
            description: day.description || "",
            short_description: day.short_description || "",
            city: day.city || "",
            pickup_location: day.pickup_location || "",
            dropoff_location: day.dropoff_location || "",
            items: day.items?.map(item => ({
              custom_title: item.custom_title || "",
              custom_description: item.custom_description || "",
            })) || [],
          })) || [],
        };

        const targetLanguages = Array.from(selectedLanguages).filter(l => l !== "en");
        
        if (targetLanguages.length > 0) {
          const { data: translateData, error: translateError } = await supabase.functions.invoke(
            "translate-booking",
            {
              body: {
                content: contentToTranslate,
                targetLanguages,
                sourceLanguage: "en",
              },
            }
          );

          if (translateError) {
            console.error("Translation error:", translateError);
            toast({
              title: isArabic ? "تحذير" : "Warning",
              description: isArabic 
                ? "فشلت الترجمة، سيتم إنشاء الرابط بدون ترجمات"
                : "Translation failed, link will be created without translations",
              variant: "destructive",
            });
          } else if (translateData?.translations) {
            metadata.translations = translateData.translations;
          }
        }
        
        metadata.available_languages = Array.from(selectedLanguages);
        setIsTranslating(false);
      }

      const { data, error } = await supabase
        .from("booking_share_tokens")
        .insert({
          booking_id: bookingId,
          company_id: companyId,
          created_by: userId,
          is_active: true,
          expires_at: enableExpiration && expirationDate ? expirationDate.toISOString() : null,
          metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      const shareUrl = `${window.location.origin}/booking/${data.token}`;
      await navigator.clipboard.writeText(shareUrl);
      onRefetch();
      toast({
        title: isArabic ? "تم إنشاء الرابط!" : "Link created!",
        description: isArabic ? "تم نسخ الرابط إلى الحافظة" : "Link copied to clipboard",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      setIsTranslating(false);
      toast({
        title: isArabic ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateLink = useMutation({
    mutationFn: async ({ tokenId, updates }: { tokenId: string; updates: any }) => {
      const { error } = await supabase
        .from("booking_share_tokens")
        .update(updates)
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      onRefetch();
      toast({ title: isArabic ? "تم التحديث" : "Updated" });
    },
  });

  const deactivateLink = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("booking_share_tokens")
        .update({ is_active: false })
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      onRefetch();
      toast({ title: isArabic ? "تم إلغاء الرابط" : "Link deactivated" });
    },
  });

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/booking/${token}`;
    await navigator.clipboard.writeText(url);
    toast({ title: isArabic ? "تم نسخ الرابط" : "Link copied!" });
  };

  const activeTokens = shareTokens.filter(t => t.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {isArabic ? "إعدادات رابط المشاركة" : "Share Link Settings"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Existing Links */}
          {activeTokens.length > 0 && (
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                {isArabic ? "الروابط النشطة" : "Active Links"}
              </Label>
              <div className="space-y-2">
                {activeTokens.map((token) => {
                  const hasPassword = !!token.metadata?.password_hash;
                  const hasExpiry = !!token.expires_at;
                  const isExpired = hasExpiry && new Date(token.expires_at!) < new Date();

                  return (
                    <div
                      key={token.id}
                      className={cn(
                        "rounded-lg border p-3 space-y-2",
                        isExpired ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-muted-foreground" />
                          <code className="text-xs font-mono text-muted-foreground">
                            ...{token.token.slice(-8)}
                          </code>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyLink(token.token)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => window.open(`/booking/${token.token}`, "_blank")}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deactivateLink.mutate(token.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {hasPassword && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Lock className="w-3 h-3" />
                            {isArabic ? "محمي بكلمة مرور" : "Password protected"}
                          </Badge>
                        )}
                        {hasExpiry && (
                          <Badge
                            variant={isExpired ? "destructive" : "secondary"}
                            className="text-[10px] gap-1"
                          >
                            <Clock className="w-3 h-3" />
                            {isExpired
                              ? (isArabic ? "منتهي الصلاحية" : "Expired")
                              : `${isArabic ? "ينتهي" : "Expires"} ${format(new Date(token.expires_at!), "MMM d, yyyy")}`
                            }
                          </Badge>
                        )}
                        {!hasPassword && !hasExpiry && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                            <CheckCircle className="w-3 h-3" />
                            {isArabic ? "بدون قيود" : "No restrictions"}
                          </Badge>
                        )}
                        {token.metadata?.available_languages && token.metadata.available_languages.length > 1 && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Languages className="w-3 h-3" />
                            {token.metadata.available_languages.length} {isArabic ? "لغات" : "languages"}
                          </Badge>
                        )}
                      </div>

                      <p className="text-[10px] text-muted-foreground">
                        {isArabic ? "تم الإنشاء" : "Created"} {format(new Date(token.created_at), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                  );
                })}
              </div>

              <Separator />
            </div>
          )}

          {/* Create New Link */}
          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {isArabic ? "إنشاء رابط جديد" : "Create New Link"}
            </Label>

            {/* Password Protection */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="password-toggle" className="text-sm font-medium cursor-pointer">
                    {isArabic ? "حماية بكلمة مرور" : "Password Protection"}
                  </Label>
                </div>
                <Switch
                  id="password-toggle"
                  checked={enablePassword}
                  onCheckedChange={setEnablePassword}
                />
              </div>

              {enablePassword && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs text-muted-foreground">
                    {isArabic ? "كلمة المرور" : "Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isArabic ? "أدخل كلمة المرور" : "Enter password"}
                      className="pe-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute end-0 top-0 h-full w-10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {isArabic
                      ? "سيحتاج العملاء إلى إدخال كلمة المرور لعرض البرنامج"
                      : "Clients will need to enter this password to view the itinerary"
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Expiration Date */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="expiration-toggle" className="text-sm font-medium cursor-pointer">
                    {isArabic ? "تاريخ انتهاء الصلاحية" : "Expiration Date"}
                  </Label>
                </div>
                <Switch
                  id="expiration-toggle"
                  checked={enableExpiration}
                  onCheckedChange={setEnableExpiration}
                />
              </div>

              {enableExpiration && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "1d", label: isArabic ? "يوم" : "1 day" },
                      { value: "3d", label: isArabic ? "3 أيام" : "3 days" },
                      { value: "1w", label: isArabic ? "أسبوع" : "1 week" },
                      { value: "2w", label: isArabic ? "أسبوعين" : "2 weeks" },
                      { value: "1m", label: isArabic ? "شهر" : "1 month" },
                      { value: "3m", label: isArabic ? "3 أشهر" : "3 months" },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handlePresetChange(preset.value)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-medium rounded-full border transition-all",
                          expirationPreset === preset.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{isArabic ? "أو اختر تاريخ" : "Or pick a date"}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "justify-start text-left font-normal h-8",
                            !expirationDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="w-3.5 h-3.5 me-2" />
                          {expirationDate ? format(expirationDate, "MMM d, yyyy") : (isArabic ? "اختر تاريخ" : "Pick date")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={expirationDate}
                          onSelect={(d) => { setExpirationDate(d); setExpirationPreset(""); }}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {expirationDate && (
                    <p className="text-[10px] text-muted-foreground">
                      {isArabic ? "سينتهي الرابط في" : "Link will expire on"} {format(expirationDate, "EEEE, MMM d, yyyy")}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* AI Translation */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="translation-toggle" className="text-sm font-medium cursor-pointer">
                    {isArabic ? "ترجمة AI" : "AI Translation"}
                  </Label>
                  <Badge variant="secondary" className="text-[9px] gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI
                  </Badge>
                </div>
                <Switch
                  id="translation-toggle"
                  checked={enableTranslation}
                  onCheckedChange={setEnableTranslation}
                />
              </div>

              {enableTranslation && (
                <div className="space-y-3 pt-2">
                  <Label className="text-xs text-muted-foreground">
                    {isArabic ? "اختر اللغات المتاحة للعميل" : "Select languages available for the client"}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {TRANSLATION_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => toggleLanguage(lang.code)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-start",
                          selectedLanguages.has(lang.code)
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <span className="text-base">{lang.flag}</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{lang.nativeLabel}</span>
                          <span className="text-[10px] text-muted-foreground ms-1">({lang.label})</span>
                        </div>
                        {selectedLanguages.has(lang.code) && (
                          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {isArabic
                      ? "سيتم ترجمة محتوى البرنامج تلقائياً باستخدام الذكاء الاصطناعي"
                      : "Itinerary content will be automatically translated using AI"
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {isArabic ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={() => createLink.mutate()}
            disabled={createLink.isPending || isTranslating || (enablePassword && !password.trim())}
            className="gold-gradient text-accent-foreground gap-2"
          >
            {(createLink.isPending || isTranslating) && <Loader2 className="w-4 h-4 animate-spin" />}
            {isTranslating ? (
              isArabic ? "جاري الترجمة..." : "Translating..."
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                {isArabic ? "إنشاء رابط" : "Create Link"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
