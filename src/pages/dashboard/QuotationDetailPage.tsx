import { useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, FileText, Calendar, DollarSign,
  Printer, Send, CheckCircle2, XCircle, Clock,
  Pencil, Save, User, MapPin, Phone, Mail,
  Building2, Globe, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";

type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled";

const STATUS_CONFIG: Record<QuotationStatus, { label: string; className: string; icon: typeof FileText }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground", icon: FileText },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700", icon: Send },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700", icon: XCircle },
  expired: { label: "Expired", className: "bg-orange-100 text-orange-700", icon: Clock },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground", icon: XCircle },
};

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { direction } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  // Debounced text fields
  const [localPaymentTerms, setLocalPaymentTerms] = useState<string | null>(null);
  const [localClientNotes, setLocalClientNotes] = useState<string | null>(null);
  const [localInternalNotes, setLocalInternalNotes] = useState<string | null>(null);
  const [localTerms, setLocalTerms] = useState<string | null>(null);

  const { data: quotation, isLoading } = useQuery({
    queryKey: ["quotation", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("*, customers(full_name, email, phone, nationality, country, city), trips(trip_number, title, total_days, start_date, end_date, adults, children)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: company } = useQuery({
    queryKey: ["company-detail", quotation?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("name, email, phone, logo_url, address")
        .eq("id", quotation.company_id)
        .single();
      return data;
    },
    enabled: !!quotation?.company_id,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings-qtn", quotation?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("logo_url, tagline, website")
        .eq("company_id", quotation.company_id)
        .single();
      return data;
    },
    enabled: !!quotation?.company_id,
  });

  const updateQuotation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("quotations").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      toast({ title: "Quotation updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const saveTextField = useCallback((field: string, value: string | null) => {
    if (value !== null && value !== (quotation?.[field] || "")) {
      updateQuotation.mutate({ [field]: value });
    }
  }, [quotation, updateQuotation]);

  const tripSnapshot = quotation?.trip_snapshot as any;
  const days = tripSnapshot?.days || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
          <FileText className="w-7 h-7 text-muted-foreground/30" />
        </div>
        <p className="text-sm font-medium text-foreground">Quotation not found</p>
        <p className="text-xs text-muted-foreground">This quotation may have been deleted or you don't have access.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/quotations")} className="gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5 rtl:scale-x-[-1]" /> Back to Quotations
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[quotation.status as QuotationStatus] || STATUS_CONFIG.draft;

  return (
    <div className="space-y-6">
      {/* Header - hidden in print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/quotations")} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-display text-foreground flex items-center gap-2 flex-wrap">
              {quotation.quotation_number}
              <Badge className={cn("text-[10px] border-0", sc.className)}>{sc.label}</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(quotation.created_at), "MMM d, yyyy")}
              {quotation.customers?.full_name && ` · ${quotation.customers.full_name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {quotation.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => updateQuotation.mutate({ status: "sent", sent_at: new Date().toISOString() })}
              disabled={updateQuotation.isPending}
            >
              <Send className="w-3.5 h-3.5" /> Mark as Sent
            </Button>
          )}
          {quotation.status === "sent" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                onClick={() => updateQuotation.mutate({ status: "accepted", accepted_at: new Date().toISOString() })}
                disabled={updateQuotation.isPending}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => updateQuotation.mutate({ status: "rejected" })}
                disabled={updateQuotation.isPending}
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </Button>
          <Select
            value={quotation.status}
            onValueChange={v => updateQuotation.mutate({ status: v })}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Printable Quotation Document */}
      <motion.div
        ref={printRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-xl overflow-hidden print:border-0 print:rounded-none print:shadow-none"
      >
        {/* Document Header */}
        <div className="p-6 sm:p-8 pb-6 border-b border-border">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              {(companySettings?.logo_url || company?.logo_url) && (
                <img
                  src={companySettings?.logo_url || company?.logo_url || ""}
                  alt={company?.name || "Company Logo"}
                  className="h-12 mb-3 object-contain"
                  loading="lazy"
                />
              )}
              <h2 className="text-xl font-bold text-foreground">{company?.name || "Company"}</h2>
              {companySettings?.tagline && (
                <p className="text-xs text-muted-foreground mt-0.5">{companySettings.tagline}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                {company?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{company.email}</span>}
                {company?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{company.phone}</span>}
                {companySettings?.website && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{companySettings.website}</span>}
              </div>
            </div>
            <div className="text-start sm:text-end">
              <h1 className="text-2xl sm:text-3xl font-bold text-accent tracking-tight">QUOTATION</h1>
              <p className="text-sm font-mono font-semibold text-foreground mt-1">{quotation.quotation_number}</p>
              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                <p>Date: {format(new Date(quotation.created_at), "MMMM d, yyyy")}</p>
                {quotation.valid_until && (
                  <p>Valid Until: <span className="font-semibold text-foreground">{format(new Date(quotation.valid_until), "MMMM d, yyyy")}</span></p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Customer + Trip Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 sm:p-8 pb-4">
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bill To</h3>
            {quotation.customers ? (
              <>
                <p className="text-sm font-semibold text-foreground">{quotation.customers.full_name}</p>
                <div className="space-y-0.5 mt-1 text-[11px] text-muted-foreground">
                  {quotation.customers.email && <p>{quotation.customers.email}</p>}
                  {quotation.customers.phone && <p>{quotation.customers.phone}</p>}
                  {quotation.customers.country && <p>{[quotation.customers.city, quotation.customers.country].filter(Boolean).join(", ")}</p>}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">No customer linked</p>
            )}
          </div>
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Trip Details</h3>
            {quotation.trips ? (
              <div className="space-y-0.5 text-[11px] text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">{quotation.trips.title}</p>
                <p>{quotation.trips.trip_number} · {quotation.trips.total_days} days</p>
                {quotation.trips.start_date && (
                  <p>{format(new Date(quotation.trips.start_date), "MMM d")} – {quotation.trips.end_date ? format(new Date(quotation.trips.end_date), "MMM d, yyyy") : ""}</p>
                )}
                <p>{quotation.trips.adults} adults{quotation.trips.children > 0 ? `, ${quotation.trips.children} children` : ""}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No trip linked</p>
            )}
          </div>
        </div>

        {/* Itinerary Summary */}
        {days.length > 0 && (
          <div className="px-6 sm:px-8 pb-4">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Itinerary Overview</h3>
            <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-start p-2.5 font-semibold text-muted-foreground w-16">Day</th>
                    <th className="text-start p-2.5 font-semibold text-muted-foreground">Title</th>
                    <th className="text-start p-2.5 font-semibold text-muted-foreground w-24">City</th>
                    <th className="text-start p-2.5 font-semibold text-muted-foreground">Highlights</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2.5 font-mono font-semibold text-accent">Day {day.day_number}</td>
                      <td className="p-2.5 font-medium text-foreground">{day.title || `Day ${day.day_number}`}</td>
                      <td className="p-2.5 text-muted-foreground">{day.city || "—"}</td>
                      <td className="p-2.5 text-muted-foreground">
                        {(day.items || []).slice(0, 3).map((item: any) => item.title || item.custom_title).filter(Boolean).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pricing */}
        <div className="px-6 sm:px-8 pb-6">
          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono text-foreground">{quotation.currency} {Number(quotation.subtotal || 0).toLocaleString()}</span>
              </div>
              {Number(quotation.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Discount</span>
                  <span className="font-mono">-{quotation.currency} {Number(quotation.discount_amount).toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span className="text-foreground">Total</span>
                <span className="font-mono text-accent">{quotation.currency} {Number(quotation.total_amount || 0).toLocaleString()}</span>
              </div>
              {Number(quotation.deposit_amount || 0) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Deposit Due ({quotation.deposit_percentage}%)</span>
                  <span className="font-mono font-semibold text-foreground">{quotation.currency} {Number(quotation.deposit_amount).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Terms */}
        {quotation.payment_terms && (
          <div className="px-6 sm:px-8 pb-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Terms</h3>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{quotation.payment_terms}</p>
          </div>
        )}

        {/* Client Notes */}
        {quotation.client_notes && (
          <div className="px-6 sm:px-8 pb-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{quotation.client_notes}</p>
          </div>
        )}

        {/* Terms and Conditions */}
        {quotation.terms_and_conditions && (
          <div className="px-6 sm:px-8 pb-8 border-t border-border pt-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Terms & Conditions</h3>
            <p className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{quotation.terms_and_conditions}</p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-muted/30 px-6 sm:px-8 py-4 text-center border-t border-border">
          <p className="text-[10px] text-muted-foreground">Thank you for your interest. We look forward to creating an unforgettable experience for you.</p>
          {company?.name && <p className="text-[10px] font-semibold text-muted-foreground mt-1">{company.name}</p>}
        </div>
      </motion.div>

      {/* Editable Fields - hidden in print */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Terms & Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Deposit %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  className="h-8 text-xs"
                  value={quotation.deposit_percentage || ""}
                  onChange={e => {
                    const pct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    const depositAmt = (pct / 100) * Number(quotation.total_amount || 0);
                    updateQuotation.mutate({ deposit_percentage: pct, deposit_amount: Math.round(depositAmt * 100) / 100 });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Deposit Amount</Label>
                <Input type="number" className="h-8 text-xs font-mono bg-muted/30" value={quotation.deposit_amount || ""} readOnly />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Validity (days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  className="h-8 text-xs"
                  value={quotation.validity_days || 14}
                  onChange={e => {
                    const d = Math.min(365, Math.max(1, parseInt(e.target.value) || 14));
                    const validUntil = format(addDays(new Date(quotation.created_at), d), "yyyy-MM-dd");
                    updateQuotation.mutate({ validity_days: d, valid_until: validUntil });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Valid Until</Label>
                <Input type="date" className="h-8 text-xs bg-muted/30" value={quotation.valid_until || ""} readOnly />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Payment Terms</Label>
              <Textarea
                className="text-xs"
                rows={3}
                value={localPaymentTerms ?? quotation.payment_terms ?? ""}
                onChange={e => setLocalPaymentTerms(e.target.value)}
                onBlur={() => saveTextField("payment_terms", localPaymentTerms)}
                placeholder="e.g., 50% deposit upon confirmation, balance due 30 days before travel..."
                maxLength={2000}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Notes & Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Client Notes <span className="text-muted-foreground">(visible on quotation)</span></Label>
              <Textarea
                className="text-xs"
                rows={3}
                value={localClientNotes ?? quotation.client_notes ?? ""}
                onChange={e => setLocalClientNotes(e.target.value)}
                onBlur={() => saveTextField("client_notes", localClientNotes)}
                placeholder="Notes visible to the client..."
                maxLength={2000}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Internal Notes <span className="text-muted-foreground">(not visible to client)</span></Label>
              <Textarea
                className="text-xs"
                rows={2}
                value={localInternalNotes ?? quotation.notes ?? ""}
                onChange={e => setLocalInternalNotes(e.target.value)}
                onBlur={() => saveTextField("notes", localInternalNotes)}
                placeholder="Internal notes..."
                maxLength={1000}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Terms & Conditions</Label>
              <Textarea
                className="text-xs"
                rows={4}
                value={localTerms ?? quotation.terms_and_conditions ?? ""}
                onChange={e => setLocalTerms(e.target.value)}
                onBlur={() => saveTextField("terms_and_conditions", localTerms)}
                placeholder="Cancellation policy, inclusions/exclusions, liability terms..."
                maxLength={5000}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
