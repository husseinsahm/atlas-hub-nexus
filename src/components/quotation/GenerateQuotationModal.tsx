import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, DollarSign, Calendar, User, MapPin, Percent, Receipt } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";

interface GenerateQuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Source data - pass one of these
  bookingId?: string;
  tripId?: string;
  leadId?: string;
  customerId?: string;
}

export function GenerateQuotationModal({
  open, onOpenChange, bookingId, tripId, leadId, customerId,
}: GenerateQuotationModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;

  const [loading, setLoading] = useState(false);
  const [validityDays, setValidityDays] = useState(14);
  const [depositPercentage, setDepositPercentage] = useState(30);
  const [discountType, setDiscountType] = useState<"none" | "fixed" | "percentage">("none");
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState("50% deposit upon confirmation. Balance due 30 days before travel.");
  const [clientNotes, setClientNotes] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState(
    "• Prices are subject to availability at the time of booking.\n• Cancellation fees may apply as per our cancellation policy.\n• Travel insurance is strongly recommended.\n• All prices are in the quoted currency."
  );

  // Fetch booking data if bookingId
  const { data: booking } = useQuery({
    queryKey: ["qtn-booking", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, customers(id, full_name, email, phone, nationality, country, city)")
        .eq("id", bookingId!)
        .single();
      return data;
    },
    enabled: !!bookingId && open,
  });

  // Fetch booking itinerary days
  const { data: bookingDays = [] } = useQuery({
    queryKey: ["qtn-booking-days", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_days")
        .select("*, booking_day_items(*)")
        .eq("booking_id", bookingId!)
        .order("day_number");
      return data || [];
    },
    enabled: !!bookingId && open,
  });

  // Fetch booking services
  const { data: bookingServices = [] } = useQuery({
    queryKey: ["qtn-booking-services", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_services")
        .select("*")
        .eq("booking_id", bookingId!)
        .neq("status", "cancelled")
        .order("sort_order");
      return data || [];
    },
    enabled: !!bookingId && open,
  });

  // Fetch trip data if tripId
  const { data: trip } = useQuery({
    queryKey: ["qtn-trip", tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from("trips")
        .select("*, customers(id, full_name, email, phone, nationality, country, city)")
        .eq("id", tripId!)
        .single();
      return data;
    },
    enabled: !!tripId && open,
  });

  // Fetch trip days
  const { data: tripDays = [] } = useQuery({
    queryKey: ["qtn-trip-days", tripId],
    queryFn: async () => {
      const { data } = await supabase
        .from("trip_days")
        .select("*, trip_day_items(*)")
        .eq("trip_id", tripId!)
        .order("day_number");
      return data || [];
    },
    enabled: !!tripId && open,
  });

  // Fetch company settings for number sequence
  const { data: companySettings } = useQuery({
    queryKey: ["qtn-company-settings", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("quotation_prefix, quotation_next_number, default_currency")
        .eq("company_id", companyId!)
        .single();
      return data;
    },
    enabled: !!companyId && open,
  });

  // Fetch lead if leadId
  const { data: lead } = useQuery({
    queryKey: ["qtn-lead", leadId],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").eq("id", leadId!).single();
      return data;
    },
    enabled: !!leadId && open,
  });

  // Computed source data
  const source = booking || trip;
  const days = bookingId ? bookingDays : tripDays;
  const currency = source?.currency || companySettings?.default_currency || "USD";
  const sellingPrice = booking?.selling_price || trip?.selling_price || 0;
  const totalCost = booking?.total_cost || trip?.total_cost || 0;
  const resolvedCustomerId = booking?.customer_id || trip?.customer_id || customerId || null;
  const resolvedLeadId = booking?.lead_id || trip?.lead_id || leadId || null;
  const customerName = (source as any)?.customers?.full_name || lead?.full_name || "—";

  // Calculate pricing
  const subtotal = sellingPrice || totalCost;
  const discountAmount = discountType === "fixed" ? discountValue
    : discountType === "percentage" ? Math.round((subtotal * discountValue / 100) * 100) / 100
    : 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const depositAmount = Math.round((totalAmount * depositPercentage / 100) * 100) / 100;

  // Build trip snapshot for the quotation
  const buildSnapshot = () => {
    const snapshotDays = days.map((day: any) => {
      const items = (day.booking_day_items || day.trip_day_items || []).map((item: any) => ({
        custom_title: item.custom_title,
        custom_description: item.custom_description,
        category: item.category,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        currency: item.currency,
        start_time: item.start_time,
        duration_minutes: item.duration_minutes,
        notes: item.notes,
      }));
      return {
        day_number: day.day_number,
        title: day.title,
        description: day.description || day.short_description,
        city: day.city,
        date: day.date,
        pickup_location: day.pickup_location,
        dropoff_location: day.dropoff_location,
        items,
      };
    });

    // Build services breakdown
    const servicesBreakdown = bookingServices.map((s: any) => ({
      title: s.title,
      service_type: s.service_type,
      quantity: s.quantity,
      unit_price: s.unit_price,
      total_cost: s.total_cost,
      currency: s.currency,
      service_date: s.service_date,
      description: s.description,
    }));

    return {
      days: snapshotDays,
      services: servicesBreakdown,
      totalDays: source?.total_days || days.length,
      adults: source?.adults || 1,
      children: source?.children || 0,
      startDate: source?.start_date,
      endDate: source?.end_date,
      title: source?.title || "",
      description: source?.description || "",
    };
  };

  const handleGenerate = async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      // Generate quotation number
      const prefix = companySettings?.quotation_prefix || "QTN";
      const nextNum = companySettings?.quotation_next_number || 1;
      const quotationNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      const validUntil = format(addDays(new Date(), validityDays), "yyyy-MM-dd");

      const { data: newQuotation, error } = await supabase
        .from("quotations")
        .insert({
          company_id: companyId,
          quotation_number: quotationNumber,
          customer_id: resolvedCustomerId,
          lead_id: resolvedLeadId,
          trip_id: tripId || booking?.trip_id || null,
          status: "draft",
          currency,
          subtotal,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          deposit_percentage: depositPercentage,
          deposit_amount: depositAmount,
          validity_days: validityDays,
          valid_until: validUntil,
          payment_terms: paymentTerms,
          client_notes: clientNotes || null,
          terms_and_conditions: termsAndConditions,
          trip_snapshot: buildSnapshot(),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Increment company quotation number
      await supabase
        .from("company_settings")
        .update({ quotation_next_number: nextNum + 1 })
        .eq("company_id", companyId);

      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast({ title: "Quotation generated", description: quotationNumber });
      onOpenChange(false);
      navigate(`/dashboard/quotations/${newQuotation.id}`);
    } catch (err: any) {
      toast({ title: "Failed to generate quotation", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <ModalDarkHeader
          icon={<Receipt className="w-5 h-5" />}
          title="Generate Quotation"
          description={customerName !== "—" ? `For ${customerName}` : "Create a professional quote"}
        />

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Source preview */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <FileText className="w-3.5 h-3.5 text-accent" />
              {source?.title || lead?.full_name || "Quotation"}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {customerName !== "—" && (
                <span className="flex items-center gap-1"><User className="w-3 h-3" />{customerName}</span>
              )}
              {days.length > 0 && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{days.length} days</span>
              )}
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />{currency} {subtotal.toLocaleString()}
              </span>
            </div>
          </div>

          <Separator />

          {/* Pricing */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold">Pricing</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Discount</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No discount</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountType !== "none" && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    {discountType === "percentage" ? "Discount %" : "Discount Amount"}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-xs"
                    value={discountValue || ""}
                    onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{currency} {subtotal.toLocaleString()}</span></div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-destructive"><span>Discount</span><span className="font-mono">-{currency} {discountAmount.toLocaleString()}</span></div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="font-mono text-accent">{currency} {totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Terms */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Validity (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                className="h-8 text-xs"
                value={validityDays}
                onChange={e => setValidityDays(parseInt(e.target.value) || 14)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Deposit %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-8 text-xs"
                value={depositPercentage}
                onChange={e => setDepositPercentage(Math.min(100, parseInt(e.target.value) || 0))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Payment Terms</Label>
            <Textarea
              className="text-xs"
              rows={2}
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Client Notes (optional)</Label>
            <Textarea
              className="text-xs"
              rows={2}
              value={clientNotes}
              onChange={e => setClientNotes(e.target.value)}
              placeholder="Special notes for the client..."
              maxLength={2000}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Terms & Conditions</Label>
            <Textarea
              className="text-xs"
              rows={4}
              value={termsAndConditions}
              onChange={e => setTermsAndConditions(e.target.value)}
              maxLength={5000}
            />
          </div>
        </div>

        <DialogFooter className="p-4 pt-3 border-t border-border bg-muted/20">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            onClick={handleGenerate}
            disabled={loading || !companyId}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Receipt className="w-3.5 h-3.5" />
            Generate Quotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
