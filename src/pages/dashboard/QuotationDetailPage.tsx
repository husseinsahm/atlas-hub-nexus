import { useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ArrowLeft, Loader2, FileText, Calendar, DollarSign,
  Printer, Send, CheckCircle2, XCircle, Clock,
  Pencil, Save, User, MapPin, Phone, Mail,
  Building2, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);

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
  });

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const tripSnapshot = quotation?.trip_snapshot as any;
  const days = tripSnapshot?.days || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-20">
        <FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-muted-foreground">Quotation not found</p>
      </div>
    );
  }

  const sc = STATUS_CONFIG[quotation.status as QuotationStatus] || STATUS_CONFIG.draft;

  return (
    <div className="space-y-6">
      {/* Header - hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/quotations")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              {quotation.quotation_number}
              <Badge className={cn("text-[10px]", sc.className)}>{sc.label}</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Created {format(new Date(quotation.created_at), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quotation.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => updateQuotation.mutate({ status: "sent", sent_at: new Date().toISOString() })}
            >
              <Send className="w-3.5 h-3.5" /> Mark as Sent
            </Button>
          )}
          {quotation.status === "sent" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 border-emerald-300 text-emerald-600"
                onClick={() => updateQuotation.mutate({ status: "accepted", accepted_at: new Date().toISOString() })}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5 border-red-300 text-red-600"
                onClick={() => updateQuotation.mutate({ status: "rejected" })}
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
      <div ref={printRef} className="bg-card border border-border rounded-xl overflow-hidden print:border-0 print:rounded-none print:shadow-none">
        {/* Document Header */}
        <div className="p-8 pb-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              {(companySettings?.logo_url || company?.logo_url) && (
                <img
                  src={companySettings?.logo_url || company?.logo_url || ""}
                  alt="Company Logo"
                  className="h-12 mb-3 object-contain"
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
            <div className="text-end">
              <h1 className="text-3xl font-bold text-accent tracking-tight">QUOTATION</h1>
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
        <div className="grid grid-cols-2 gap-6 p-8 pb-4">
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bill To</h3>
            <p className="text-sm font-semibold text-foreground">{quotation.customers?.full_name || "—"}</p>
            <div className="space-y-0.5 mt-1 text-[11px] text-muted-foreground">
              {quotation.customers?.email && <p>{quotation.customers.email}</p>}
              {quotation.customers?.phone && <p>{quotation.customers.phone}</p>}
              {quotation.customers?.country && <p>{[quotation.customers.city, quotation.customers.country].filter(Boolean).join(", ")}</p>}
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Trip Details</h3>
            {quotation.trips && (
              <div className="space-y-0.5 text-[11px] text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">{quotation.trips.title}</p>
                <p>{quotation.trips.trip_number} · {quotation.trips.total_days} days</p>
                {quotation.trips.start_date && (
                  <p>{format(new Date(quotation.trips.start_date), "MMM d")} – {quotation.trips.end_date ? format(new Date(quotation.trips.end_date), "MMM d, yyyy") : ""}</p>
                )}
                <p>{quotation.trips.adults} adults{quotation.trips.children > 0 ? `, ${quotation.trips.children} children` : ""}</p>
              </div>
            )}
          </div>
        </div>

        {/* Itinerary Summary */}
        {days.length > 0 && (
          <div className="px-8 pb-4">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Itinerary Overview</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-start p-2.5 font-semibold text-muted-foreground">Day</th>
                    <th className="text-start p-2.5 font-semibold text-muted-foreground">Title</th>
                    <th className="text-start p-2.5 font-semibold text-muted-foreground">City</th>
                    <th className="text-start p-2.5 font-semibold text-muted-foreground">Highlights</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2.5 font-mono font-semibold text-accent">Day {day.day_number}</td>
                      <td className="p-2.5 font-medium">{day.title || `Day ${day.day_number}`}</td>
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
        <div className="px-8 pb-6">
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">{quotation.currency} {Number(quotation.subtotal || 0).toLocaleString()}</span>
              </div>
              {Number(quotation.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>Discount</span>
                  <span className="font-mono">-{quotation.currency} {Number(quotation.discount_amount).toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
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
          <div className="px-8 pb-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Terms</h3>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{quotation.payment_terms}</p>
          </div>
        )}

        {/* Client Notes */}
        {quotation.client_notes && (
          <div className="px-8 pb-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{quotation.client_notes}</p>
          </div>
        )}

        {/* Terms and Conditions */}
        {quotation.terms_and_conditions && (
          <div className="px-8 pb-8 border-t border-border pt-6">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Terms & Conditions</h3>
            <p className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed">{quotation.terms_and_conditions}</p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-muted/30 px-8 py-4 text-center">
          <p className="text-[10px] text-muted-foreground">Thank you for your interest. We look forward to creating an unforgettable experience for you.</p>
          {company?.name && <p className="text-[10px] font-semibold text-muted-foreground mt-1">{company.name}</p>}
        </div>
      </div>

      {/* Editable Fields - hidden in print */}
      <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Terms & Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Deposit %</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={quotation.deposit_percentage || ""}
                  onChange={e => {
                    const pct = parseFloat(e.target.value) || 0;
                    const depositAmt = (pct / 100) * Number(quotation.total_amount || 0);
                    updateQuotation.mutate({ deposit_percentage: pct, deposit_amount: Math.round(depositAmt * 100) / 100 });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Deposit Amount</Label>
                <Input type="number" className="h-8 text-xs font-mono" value={quotation.deposit_amount || ""} readOnly />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Validity (days)</Label>
                <Input
                  type="number"
                  className="h-8 text-xs"
                  value={quotation.validity_days || 14}
                  onChange={e => {
                    const days = parseInt(e.target.value) || 14;
                    const validUntil = format(addDays(new Date(quotation.created_at), days), "yyyy-MM-dd");
                    updateQuotation.mutate({ validity_days: days, valid_until: validUntil });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Valid Until</Label>
                <Input type="date" className="h-8 text-xs" value={quotation.valid_until || ""} readOnly />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Payment Terms</Label>
              <Textarea
                className="text-xs"
                rows={3}
                value={quotation.payment_terms || ""}
                onChange={e => updateQuotation.mutate({ payment_terms: e.target.value })}
                placeholder="e.g., 50% deposit upon confirmation, balance due 30 days before travel..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Notes & Conditions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Client Notes</Label>
              <Textarea
                className="text-xs"
                rows={3}
                value={quotation.client_notes || ""}
                onChange={e => updateQuotation.mutate({ client_notes: e.target.value })}
                placeholder="Notes visible to the client..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Internal Notes</Label>
              <Textarea
                className="text-xs"
                rows={2}
                value={quotation.notes || ""}
                onChange={e => updateQuotation.mutate({ notes: e.target.value })}
                placeholder="Internal notes (not visible to client)..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Terms & Conditions</Label>
              <Textarea
                className="text-xs"
                rows={4}
                value={quotation.terms_and_conditions || ""}
                onChange={e => updateQuotation.mutate({ terms_and_conditions: e.target.value })}
                placeholder="Cancellation policy, inclusions/exclusions, liability terms..."
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
