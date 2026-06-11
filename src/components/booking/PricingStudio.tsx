import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Calculator, Users, TrendingUp, Percent, DollarSign,
  Loader2, Sparkles, Check, Minus, Plus,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  servicesCost: number; // active cost from booking_services
  isArabic?: boolean;
}

const MARKUP_PRESETS = [10, 15, 20, 25, 30, 40];
const ROUNDING_PRESETS = [0, 1, 5, 10, 50, 100];

function roundTo(value: number, step: number): number {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

export function PricingStudio({ open, onOpenChange, booking, servicesCost, isArabic }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const initialPax = booking?.pax_breakdown || {};
  const [adults, setAdults] = useState<number>(Number(initialPax.adults ?? booking?.adults ?? 1));
  const [children, setChildren] = useState<number>(Number(initialPax.children ?? booking?.children ?? 0));
  const [infants, setInfants] = useState<number>(Number(initialPax.infants ?? 0));
  const [markup, setMarkup] = useState<number>(Number(booking?.markup_pct ?? 25));
  const [rounding, setRounding] = useState<number>(Number(booking?.rounding_step ?? 0));
  const [groupDiscount, setGroupDiscount] = useState<number>(Number(booking?.group_discount_pct ?? 0));
  const [groupThreshold] = useState<number>(6);

  // Reset on booking change
  useEffect(() => {
    if (!open) return;
    const px = booking?.pax_breakdown || {};
    setAdults(Number(px.adults ?? booking?.adults ?? 1));
    setChildren(Number(px.children ?? booking?.children ?? 0));
    setInfants(Number(px.infants ?? 0));
    setMarkup(Number(booking?.markup_pct ?? 25));
    setRounding(Number(booking?.rounding_step ?? 0));
    setGroupDiscount(Number(booking?.group_discount_pct ?? 0));
  }, [booking?.id, open]);

  const currency = booking?.currency || "USD";
  const cost = useMemo(() => {
    const fromServices = Number(servicesCost) || 0;
    if (fromServices > 0) return fromServices;
    return Number(booking?.total_cost || 0);
  }, [servicesCost, booking?.total_cost]);

  const calc = useMemo(() => {
    const paxBillable = adults + children * 0.5; // children at 50% by convention
    const totalPax = adults + children + infants;
    const groupEligible = totalPax >= groupThreshold && groupDiscount > 0;
    const markupAmount = cost * (markup / 100);
    const afterMarkup = cost + markupAmount;
    const discountAmount = groupEligible ? afterMarkup * (groupDiscount / 100) : 0;
    const beforeRounding = afterMarkup - discountAmount;
    const total = roundTo(beforeRounding, rounding);
    const perAdult = paxBillable > 0 ? total / paxBillable : 0;
    const perChild = perAdult * 0.5;
    const profit = total - cost;
    const margin = total > 0 ? (profit / total) * 100 : 0;
    return {
      paxBillable, totalPax, markupAmount, discountAmount, total,
      perAdult, perChild, profit, margin, groupEligible,
    };
  }, [cost, markup, rounding, groupDiscount, adults, children, infants, groupThreshold]);

  const apply = useMutation({
    mutationFn: async () => {
      const updates = {
        pax_breakdown: { adults, children, infants },
        markup_pct: markup,
        rounding_step: rounding,
        group_discount_pct: groupDiscount,
        selling_price: calc.total,
        adults,
        children,
      };
      const { error } = await supabase.from("bookings").update(updates).eq("id", booking.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", booking.id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      toast({
        title: isArabic ? "تم تحديث السعر" : "Pricing applied",
        description: isArabic
          ? `سعر البيع الجديد: ${calc.total.toLocaleString()} ${currency}`
          : `New selling price: ${calc.total.toLocaleString()} ${currency}`,
      });
      onOpenChange(false);
    },
    onError: (e: any) => toast({
      title: isArabic ? "فشل التحديث" : "Update failed",
      description: e.message,
      variant: "destructive",
    }),
  });

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const PaxStepper = ({ label, value, setValue, min = 0 }: any) => (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button" size="icon" variant="outline" className="h-7 w-7"
          onClick={() => setValue(Math.max(min, value - 1))}
        >
          <Minus className="w-3 h-3" />
        </Button>
        <span className="w-8 text-center text-sm font-mono font-bold tabular-nums">{value}</span>
        <Button
          type="button" size="icon" variant="outline" className="h-7 w-7"
          onClick={() => setValue(value + 1)}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className="w-9 h-9 rounded-xl gold-gradient flex items-center justify-center shadow-md">
              <Calculator className="w-4.5 h-4.5 text-accent-foreground" />
            </div>
            <div>
              <div className="text-base">{isArabic ? "استوديو التسعير" : "Pricing Studio"}</div>
              <p className="text-[11px] font-normal text-muted-foreground">
                {isArabic ? "احسب سعر البيع وهامش الربح فورياً" : "Calculate selling price & margin in real-time"}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-5 mt-2">
          {/* LEFT — Inputs */}
          <div className="space-y-4">
            {/* Pax */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {isArabic ? "عدد المسافرين" : "Passengers (Pax)"}
              </Label>
              <div className="space-y-1.5">
                <PaxStepper label={isArabic ? "بالغ" : "Adults"} value={adults} setValue={setAdults} min={1} />
                <PaxStepper label={isArabic ? "طفل (50%)" : "Children (50%)"} value={children} setValue={setChildren} />
                <PaxStepper label={isArabic ? "رضيع (مجاناً)" : "Infants (free)"} value={infants} setValue={setInfants} />
              </div>
            </div>

            {/* Markup */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" />
                {isArabic ? "نسبة الربح" : "Markup %"}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {MARKUP_PRESETS.map(p => (
                  <button
                    key={p} type="button"
                    onClick={() => setMarkup(p)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors",
                      markup === p
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-background border-border hover:border-accent/40",
                    )}
                  >{p}%</button>
                ))}
                <Input
                  type="number" min={0} max={500}
                  value={markup}
                  onChange={e => setMarkup(Number(e.target.value) || 0)}
                  className="h-7 w-20 text-xs"
                />
              </div>
            </div>

            {/* Rounding */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" />
                {isArabic ? "تقريب السعر" : "Rounding"}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {ROUNDING_PRESETS.map(p => (
                  <button
                    key={p} type="button"
                    onClick={() => setRounding(p)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors",
                      rounding === p
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-background border-border hover:border-accent/40",
                    )}
                  >{p === 0 ? (isArabic ? "بدون" : "None") : p}</button>
                ))}
              </div>
            </div>

            {/* Group discount */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                <Percent className="w-3 h-3" />
                {isArabic ? `خصم المجموعات (≥${groupThreshold} مسافر)` : `Group discount (≥${groupThreshold} pax)`}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={50}
                  value={groupDiscount}
                  onChange={e => setGroupDiscount(Number(e.target.value) || 0)}
                  className="h-8 w-24 text-xs"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
                {calc.groupEligible && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 text-[10px] gap-1">
                    <Check className="w-2.5 h-2.5" />
                    {isArabic ? "مفعّل" : "Applied"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — Live preview */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 self-start">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground font-display">
                {isArabic ? "المعاينة المباشرة" : "Live Preview"}
              </h4>
            </div>

            <div className="space-y-2 text-xs">
              <Row label={isArabic ? "التكلفة الإجمالية" : "Total Cost"} value={fmt(cost)} currency={currency} muted />
              <Row label={`${isArabic ? "ربح" : "Markup"} (${markup}%)`} value={`+${fmt(calc.markupAmount)}`} currency={currency} muted />
              {calc.discountAmount > 0 && (
                <Row label={isArabic ? "خصم المجموعة" : "Group discount"} value={`-${fmt(calc.discountAmount)}`} currency={currency} muted />
              )}
              <Separator />
              <Row
                label={isArabic ? "السعر الإجمالي" : "Selling Price"}
                value={fmt(calc.total)} currency={currency}
                emphasis
              />
              <Row
                label={isArabic ? "الربح" : "Profit"}
                value={`${fmt(calc.profit)} (${calc.margin.toFixed(1)}%)`}
                currency={currency}
                className={calc.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                {isArabic ? "للفرد" : "Per Person"}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">{isArabic ? "بالغ" : "Adult"}</p>
                  <p className="text-sm font-bold font-mono tabular-nums">{fmt(calc.perAdult)} <span className="text-[10px] font-normal text-muted-foreground">{currency}</span></p>
                </div>
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-[9px] text-muted-foreground uppercase">{isArabic ? "طفل" : "Child"}</p>
                  <p className="text-sm font-bold font-mono tabular-nums">{fmt(calc.perChild)} <span className="text-[10px] font-normal text-muted-foreground">{currency}</span></p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {calc.totalPax} {isArabic ? "مسافر إجمالاً" : "total pax"} · {calc.paxBillable} {isArabic ? "وحدة محاسبة" : "billable units"}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-border">
          <p className="text-[10px] text-muted-foreground">
            {isArabic
              ? "زرار التطبيق يحدّث سعر بيع الحجز ويظهر فوراً في ملخص الأرقام"
              : "Apply updates the booking's selling price and reflects instantly in the financial summary"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              className="gold-gradient text-accent-foreground gap-1.5"
              onClick={() => apply.mutate()}
              disabled={apply.isPending || cost === 0}
            >
              {apply.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {isArabic ? "تطبيق على الحجز" : "Apply to Booking"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, currency, muted, emphasis, className }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-xs", muted ? "text-muted-foreground" : "text-foreground", emphasis && "font-semibold")}>{label}</span>
      <span className={cn(
        "font-mono tabular-nums",
        emphasis ? "text-base font-bold text-foreground" : "text-xs font-semibold text-foreground",
        className,
      )}>
        {value} <span className="text-[10px] font-normal text-muted-foreground">{currency}</span>
      </span>
    </div>
  );
}
