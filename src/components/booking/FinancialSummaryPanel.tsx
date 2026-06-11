import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DollarSign, TrendingUp, CreditCard, Wallet,
  CheckCircle2, AlertCircle, Clock,
} from "lucide-react";

interface Props {
  bookingId: string;
  sellingPrice: number;
  totalCost: number;
  currency: string;
  servicesActiveCost?: number;
  isArabic?: boolean;
  onClick?: () => void;
}

export function FinancialSummaryPanel({
  bookingId,
  sellingPrice,
  totalCost,
  currency,
  servicesActiveCost,
  isArabic,
  onClick,
}: Props) {
  // Live sum from payment_records for accuracy
  const { data: payments = [] } = useQuery({
    queryKey: ["payment-records-sum", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_records")
        .select("amount")
        .eq("booking_id", bookingId);
      return data || [];
    },
    enabled: !!bookingId,
  });

  const totalPaid = useMemo(
    () => payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0),
    [payments]
  );

  // Use services active cost as primary cost source when available, fallback to booking.total_cost
  const cost = (servicesActiveCost && servicesActiveCost > 0) ? servicesActiveCost : totalCost;
  const profit = sellingPrice - cost;
  const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
  const due = Math.max(0, sellingPrice - totalPaid);
  const paidPct = sellingPrice > 0 ? Math.min(100, (totalPaid / sellingPrice) * 100) : 0;

  const paymentStatus =
    sellingPrice === 0 ? "none" :
    totalPaid >= sellingPrice ? "paid" :
    totalPaid > 0 ? "partial" : "unpaid";

  const statusConfig = {
    paid: { icon: CheckCircle2, label: isArabic ? "مدفوع" : "Paid", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    partial: { icon: Clock, label: isArabic ? "جزئي" : "Partial", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    unpaid: { icon: AlertCircle, label: isArabic ? "غير مدفوع" : "Unpaid", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    none: { icon: DollarSign, label: isArabic ? "بدون سعر" : "Not priced", className: "bg-muted text-muted-foreground" },
  };
  const sCfg = statusConfig[paymentStatus];
  const SIcon = sCfg.icon;

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const cells = [
    {
      label: isArabic ? "سعر البيع" : "Selling Price",
      value: fmt(sellingPrice),
      icon: DollarSign,
      iconClass: "text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400",
    },
    {
      label: isArabic ? "التكلفة" : "Total Cost",
      value: fmt(cost),
      icon: Wallet,
      iconClass: "text-slate-600 bg-slate-100 dark:bg-slate-800/40 dark:text-slate-400",
    },
    {
      label: isArabic ? "الربح" : "Profit",
      value: fmt(profit),
      sub: sellingPrice > 0 ? `${margin.toFixed(1)}%` : undefined,
      icon: TrendingUp,
      iconClass: profit >= 0 ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400" : "text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-400",
      valueClass: profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
    },
    {
      label: isArabic ? "مدفوع" : "Paid",
      value: fmt(totalPaid),
      icon: CheckCircle2,
      iconClass: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400",
    },
    {
      label: isArabic ? "المتبقي" : "Due",
      value: fmt(due),
      icon: CreditCard,
      iconClass: due > 0 ? "text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400" : "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400",
      valueClass: due > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400",
    },
  ];

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden shadow-sm",
        onClick && "cursor-pointer hover:shadow-md hover:border-accent/40 transition-all"
      )}
    >
      {/* Top: 5 stat cells */}
      <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-border rtl:divide-x-reverse">
        {cells.map((c, i) => (
          <div key={i} className="p-3 flex items-start gap-2.5">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", c.iconClass)}>
              <c.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                {c.label}
              </p>
              <p className={cn("text-base font-bold font-mono tabular-nums leading-tight mt-0.5", c.valueClass || "text-foreground")}>
                {c.value}
                <span className="text-[10px] font-normal text-muted-foreground ms-1">{currency}</span>
              </p>
              {c.sub && (
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.sub}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom: collection progress */}
      {sellingPrice > 0 && (
        <div className="px-4 py-2.5 border-t border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <Badge className={cn("border-0 text-[10px] font-semibold gap-1 shrink-0", sCfg.className)}>
              <SIcon className="w-3 h-3" />
              {sCfg.label}
            </Badge>
            <div className="flex-1 min-w-0">
              <Progress value={paidPct} className="h-1.5" />
            </div>
            <span className="text-xs font-mono font-semibold tabular-nums shrink-0 text-muted-foreground">
              {paidPct.toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
